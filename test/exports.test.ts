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
import { auditWorkbook } from '../src/lib/audit';
import { buildMarkdown, type AnalysisBundle } from '../src/lib/exports';

function bundleOf(file: string): AnalysisBundle {
  const abs = file.startsWith('/') ? file : path.join(__dirname, 'fixtures', file);
  const buf = fs.readFileSync(abs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const name = path.basename(abs);
  const result = extractFromTwbx(ab, name);
  result.worksheets = extractWorksheetsFromTwbx(ab, name);
  const filters = extractFiltersFromTwbx(ab, name);
  const sql = extractSqlFromTwbx(ab, name);
  const dashboards = extractDashboardsFromTwbx(ab, name);
  const provenance = extractProvenanceFromTwbx(ab, name);
  return {
    result,
    filters,
    sql,
    dashboards,
    provenance,
    audit: auditWorkbook({ result, filters, sql, dashboards, provenance }),
  };
}

const DEMO = path.join(__dirname, '..', 'public', 'demo.twbx');

describe('markdown handover document', () => {
  const md = buildMarkdown(bundleOf(DEMO));

  it('leads with the workbook name and attribution', () => {
    expect(md.startsWith('# demo')).toBe(true);
    expect(md).toContain('tableau-lineage.com');
    expect(md).toContain('Sai Kiran Andey');
  });

  it('includes the audit summary', () => {
    expect(md).toContain('## Audit');
    expect(md).toMatch(/unused field/);
  });

  it('documents dashboards and their worksheets', () => {
    expect(md).toContain('## Dashboards');
    expect(md).toContain('Total Patients');
  });

  it('documents every calculated field with its formula in a code fence', () => {
    expect(md).toContain('## Calculated fields');
    // Three backticks open and close each formula block.
    const fences = md.match(/```/g) ?? [];
    expect(fences.length).toBeGreaterThanOrEqual(2);
    expect(md).toContain('COUNTD');
  });

  it('lists filters with where they apply', () => {
    expect(md).toContain('## Filters');
    expect(md).toContain('| Field | Kind | Context | Where | Selection |');
  });

  it('escapes pipes so tables cannot be broken by field names', () => {
    const tricky = buildMarkdown({
      ...bundleOf(DEMO),
      result: {
        ...bundleOf(DEMO).result,
        parameters: [
          { name: 'Region | Segment', internal_name: '[p1]', value: 'a|b', datatype: 'string', allowed_values: null },
        ],
      },
    });
    expect(tricky).toContain('Region \\| Segment');
  });

  it('omits the SQL section when a workbook stores none', () => {
    expect(md).not.toContain('## Stored SQL');
  });

  it('includes the SQL section when a workbook has it', () => {
    const withSql = buildMarkdown(bundleOf('custom-sql.twbx'));
    expect(withSql).toContain('## Stored SQL');
    expect(withSql).toContain('```sql');
    expect(withSql).toContain('sp_monthly_sales');
  });
});
