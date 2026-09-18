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
import { buildMarkdown, buildCsv, type AnalysisBundle } from '../src/lib/exports';

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

describe('csv field inventory', () => {
  it('holds exactly one header row plus one row per field, and nothing else', () => {
    // Any extra row (a credit line, a footer) is read as a record by pandas,
    // Excel and Tableau, so it would silently corrupt field counts.
    const bundle = bundleOf(DEMO);
    const lines = buildCsv(bundle).split('\r\n');
    expect(lines[0].startsWith('\ufeffData Source')).toBe(true);
    expect(lines.length).toBe(1 + bundle.result.fields.length);
  });
});

describe('untrusted workbook content in exports', () => {
  // Field names and formulas come from a file the user did not write, so both
  // exports have to survive hostile content.

  it('neutralises spreadsheet formula injection in CSV', () => {
    const base = bundleOf(DEMO);
    const csv = buildCsv({
      ...base,
      result: {
        ...base.result,
        fields: [
          {
            datasource: 'DS',
            field_name: "=cmd|'/c calc'!A1",
            formula: '+1+1',
            ingredients: [],
            parameter_dependencies: [],
            field_type: 'calculated',
            is_table_calc: false,
            lod_type: null,
          },
        ],
      },
    });
    // Dangerous leading characters must be quoted as text, not left to execute.
    expect(csv).toContain(`"'=cmd|'/c calc'!A1"`);
    expect(csv).toContain(`"'+1+1"`);
    expect(csv).not.toMatch(/,"=cmd/);
  });

  it('does not let a formula break out of its markdown code fence', () => {
    const base = bundleOf(DEMO);
    const md = buildMarkdown({
      ...base,
      result: {
        ...base.result,
        fields: [
          {
            datasource: 'DS',
            field_name: 'Sneaky',
            // A formula that closes a 3-backtick fence and injects a heading.
            formula: '``` \n# INJECTED HEADING\n```',
            ingredients: [],
            parameter_dependencies: [],
            field_type: 'calculated',
            is_table_calc: false,
            lod_type: null,
          },
        ],
      },
    });
    // The fence around it must be longer than any run of backticks inside.
    expect(md).toContain('````');
    const afterField = md.slice(md.indexOf('#### Sneaky'));
    // The injected heading must sit inside a fence, never at document level.
    const openFence = afterField.indexOf('````');
    const injected = afterField.indexOf('# INJECTED HEADING');
    expect(openFence).toBeGreaterThanOrEqual(0);
    expect(injected).toBeGreaterThan(openFence);
  });
});
