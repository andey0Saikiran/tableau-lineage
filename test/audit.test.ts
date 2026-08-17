// Audit engine tests. The precision test at the bottom is the one that matters
// most: telling someone a field is safe to delete when it is not would destroy
// trust in the tool, so a false positive there must fail the build.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { extractFromTwbx } from '../src/lib/extractor';
import { extractFiltersFromTwbx, extractWorksheetsFromTwbx } from '../src/lib/filterExtractor';
import { extractSqlFromTwbx } from '../src/lib/sqlExtractor';
import { auditWorkbook, type AuditResult } from '../src/lib/audit';

const FIXTURES = path.join(__dirname, 'fixtures');

function audit(file: string): { result: ReturnType<typeof extractFromTwbx>; audit: AuditResult } {
  const abs = file.startsWith('/') ? file : path.join(FIXTURES, file);
  const buf = fs.readFileSync(abs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const result = extractFromTwbx(ab, path.basename(abs));
  result.worksheets = extractWorksheetsFromTwbx(ab, path.basename(abs));
  const filters = extractFiltersFromTwbx(ab, path.basename(abs));
  const sql = extractSqlFromTwbx(ab, path.basename(abs));
  return { result, audit: auditWorkbook({ result, filters, sql }) };
}

const DEMO = path.join(__dirname, '..', 'public', 'demo.twbx');

describe('dead weight', () => {
  it('finds columns that nothing references', () => {
    const { audit: a } = audit('correctness.twbx');
    const names = a.dead.map((d) => d.name);
    expect(names).toContain('Never Used Column');
    expect(names).toContain('Hidden Column');
  });

  it('flags a comment-only reference distinctly instead of calling it plain unused', () => {
    const { audit: a } = audit('correctness.twbx');
    const dep = a.dead.find((d) => d.name === 'Deprecated Field');
    expect(dep).toBeDefined();
    expect(dep!.confidence).toBe('referenced-in-comment');
  });

  it('never reports a field that a worksheet actually uses', () => {
    const { audit: a } = audit('correctness.twbx');
    const names = a.dead.map((d) => d.name);
    // Margin is on the Overview sheet; its inputs must stay alive too.
    expect(names).not.toContain('Margin');
    expect(names).not.toContain('Amount');
    expect(names).not.toContain('Cost');
    expect(names).not.toContain('Region');
  });

  it('marks parameters as likely-unused rather than certain (dashboard actions are not parsed)', () => {
    const { audit: a } = audit(DEMO);
    for (const d of a.dead.filter((x) => x.kind === 'parameter')) {
      expect(d.confidence).toBe('likely-unused');
    }
  });

  it('refuses to guess when no worksheets can be read', () => {
    const { result } = audit('correctness.twbx');
    const a = auditWorkbook({ result: { ...result, worksheets: [] }, filters: null, sql: null });
    expect(a.dead).toHaveLength(0);
    expect(a.limited).toBe(true);
    expect(a.limitations.join(' ')).toMatch(/cannot be determined/i);
  });
});

describe('duplicate calculations', () => {
  it('groups identical formulas written under different names', () => {
    const { audit: a } = audit(DEMO);
    // demo.twbx has none; the real workbook shape is covered below.
    for (const g of a.duplicates.filter((x) => x.kind === 'identical-formula')) {
      const sigs = new Set(g.members.map((m) => m.formula.replace(/\s+/g, ' ').trim().toLowerCase()));
      expect(sigs.size).toBe(1);
      expect(g.members.length).toBeGreaterThan(1);
    }
  });

  it('flags the dangerous case: same name, different formula', () => {
    const { audit: a } = audit('correctness.twbx');
    const clash = a.duplicates.find((d) => d.kind === 'same-name-different-formula');
    expect(clash).toBeDefined();
    expect(clash!.members.map((m) => m.datasource).sort()).toEqual(['Sales A', 'Sales B']);
  });
});

describe('performance lint', () => {
  it('rolls repeated filter findings into one instead of one per sheet', () => {
    const { audit: a } = audit(DEMO);
    expect(a.lint.filter((f) => f.rule === 'many-filters')).toHaveLength(1);
  });

  it('every finding carries an actionable fix', () => {
    const { audit: a } = audit(DEMO);
    for (const f of a.lint) {
      expect(f.fix.length).toBeGreaterThan(10);
      expect(f.title.length).toBeGreaterThan(0);
    }
  });

  it('detects string operations in calculations', () => {
    const { audit: a } = audit('correctness.twbx');
    expect(a.lint.map((f) => f.rule)).toContain('string-calc');
  });

  it('flags custom SQL as an optimisation blocker', () => {
    const { audit: a } = audit('custom-sql.twbx');
    expect(a.lint.map((f) => f.rule)).toContain('custom-sql');
  });
});

describe('precision (non-negotiable)', () => {
  // A false "safe to delete" is the one unacceptable bug. For every workbook we
  // have, cross-check the dead list against worksheet usage read independently.
  for (const fixture of ['correctness.twbx', 'custom-sql.twbx', 'published-ds.twbx', 'with-params.twbx', 'table-calc.twbx', DEMO]) {
    it(`reports nothing as dead that a worksheet uses: ${path.basename(fixture)}`, () => {
      const { result, audit: a } = audit(fixture);
      const used = new Set<string>();
      for (const ws of result.worksheets ?? []) {
        ws.fields.forEach((f) => used.add(f.toLowerCase()));
        ws.filters.forEach((f) => used.add(f.field.toLowerCase()));
      }
      const falsePositives = a.dead.filter((d) => used.has(d.name.toLowerCase()));
      expect(falsePositives.map((f) => f.name)).toEqual([]);
    });

    it(`reports nothing as dead that a live calculation depends on: ${path.basename(fixture)}`, () => {
      const { result, audit: a } = audit(fixture);
      const deadNames = new Set(a.dead.map((d) => d.name.toLowerCase()));
      const liveCalcs = result.fields.filter((f) => !deadNames.has(f.field_name.toLowerCase()));
      const neededByLive = new Set<string>();
      for (const f of liveCalcs) {
        f.ingredients.forEach((i) => neededByLive.add(i.toLowerCase()));
        f.parameter_dependencies.forEach((p) => neededByLive.add(p.toLowerCase()));
      }
      const contradictions = a.dead.filter((d) => neededByLive.has(d.name.toLowerCase()));
      expect(contradictions.map((c) => c.name)).toEqual([]);
    });
  }
});
