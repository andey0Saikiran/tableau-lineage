import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { extractFromTwbx } from '../src/lib/extractor';
import { extractFiltersFromTwbx, extractWorksheetsFromTwbx } from '../src/lib/filterExtractor';
import { extractSqlFromTwbx } from '../src/lib/sqlExtractor';
import {
  extractDashboardsFromTwbx,
  extractProvenanceFromTwbx,
} from '../src/lib/dashboardExtractor';
import { diffWorkbooks, type WorkbookSnapshot } from '../src/lib/diff';

const FIXTURES = path.join(__dirname, 'fixtures');

function snapshot(file: string): WorkbookSnapshot {
  const abs = path.join(FIXTURES, file);
  const buf = fs.readFileSync(abs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  // Mirror what the app assembles: the lineage extractor does not populate
  // worksheets, the worksheet extractor does.
  const result = extractFromTwbx(ab, file);
  result.worksheets = extractWorksheetsFromTwbx(ab, file);
  return {
    label: file,
    result,
    filters: extractFiltersFromTwbx(ab, file),
    sql: extractSqlFromTwbx(ab, file),
    dashboards: extractDashboardsFromTwbx(ab, file),
    provenance: extractProvenanceFromTwbx(ab, file),
  };
}

const v1 = snapshot('custom-sql.twbx');
const v2 = snapshot('custom-sql-v2.twbx');
const diff = diffWorkbooks(v1, v2);

describe('workbook diff', () => {
  it('reports no changes when comparing a workbook with itself', () => {
    const same = diffWorkbooks(v1, snapshot('custom-sql.twbx'));
    expect(same.identical).toBe(true);
    expect(same.totalChanges).toBe(0);
  });

  it('detects a changed formula', () => {
    const m = diff.calculations.modified.find((c) => c.name === 'Amount With Tax');
    expect(m).toBeDefined();
    expect(m!.beforeFormula).toContain('1.0825');
    expect(m!.afterFormula).toContain('1.0925');
  });

  it('reports the blast radius of a changed formula', () => {
    // v2 adds Margin Pct, which divides by Amount With Tax.
    const m = diff.calculations.modified.find((c) => c.name === 'Amount With Tax')!;
    expect(m.impact).toContain('Margin Pct');
  });

  it('detects a rename rather than reporting an add and a remove', () => {
    const r = diff.calculations.renamed.find((x) => x.afterName === 'Regional Revenue');
    expect(r).toBeDefined();
    expect(r!.beforeName).toBe('Region Revenue (RAWSQL)');
    // The rename must not also appear as an addition or a removal.
    expect(diff.calculations.added.map((f) => f.field_name)).not.toContain('Regional Revenue');
    expect(diff.calculations.removed.map((f) => f.field_name)).not.toContain(
      'Region Revenue (RAWSQL)',
    );
  });

  it('detects an added calculation', () => {
    expect(diff.calculations.added.map((f) => f.field_name)).toContain('Margin Pct');
  });

  it('detects a changed filter selection', () => {
    const f = diff.filters.changed.find((x) => x.field === 'Region');
    expect(f).toBeDefined();
    expect(f!.before).toContain('East');
    expect(f!.after).toContain('North');
  });

  it('detects changed custom SQL', () => {
    expect(diff.sql.changed.length).toBeGreaterThan(0);
    expect(diff.sql.changed.some((k) => k.startsWith('custom:'))).toBe(true);
  });

  it('does not report a renamed RAWSQL calculation as an SQL change', () => {
    // The rename belongs under calculations; the SQL itself is untouched.
    expect(diff.sql.added.filter((k) => k.startsWith('rawsql:'))).toHaveLength(0);
    expect(diff.sql.removed.filter((k) => k.startsWith('rawsql:'))).toHaveLength(0);
  });

  it('detects an added worksheet', () => {
    expect(diff.worksheets.added).toContain('Margins');
  });

  it('ignores reformatting: whitespace-only changes are not reported', () => {
    const reformatted: WorkbookSnapshot = {
      ...v1,
      label: 'reformatted',
      result: {
        ...v1.result,
        fields: v1.result.fields.map((f) => ({
          ...f,
          formula: f.formula.replace(/\s*\*\s*/g, '  *  ').replace(/^/, ' '),
        })),
      },
    };
    const d = diffWorkbooks(v1, reformatted);
    expect(d.calculations.modified).toHaveLength(0);
  });

  it('produces a headline ordered by blast radius', () => {
    expect(diff.headline.length).toBeGreaterThan(0);
    expect(diff.headline[0]).toMatch(/Amount With Tax changed, affecting 1 downstream field/);
  });

  it('counts every change once', () => {
    expect(diff.totalChanges).toBeGreaterThan(0);
    expect(diff.identical).toBe(false);
  });
});
