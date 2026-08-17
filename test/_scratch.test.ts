import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { extractFromTwbx, extractFromXml } from '../src/lib/extractor';
import { extractFiltersFromTwbx, extractWorksheetsFromTwbx } from '../src/lib/filterExtractor';
import { extractSqlFromTwbx } from '../src/lib/sqlExtractor';
import { extractDashboardsFromTwbx, extractDashboardsFromXml, extractProvenanceFromXml } from '../src/lib/dashboardExtractor';
import { auditWorkbook } from '../src/lib/audit';

const DEMO = path.join(__dirname, '..', 'public', 'demo.twbx');

function load(abs: string) {
  const buf = fs.readFileSync(abs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const result = extractFromTwbx(ab, path.basename(abs));
  result.worksheets = extractWorksheetsFromTwbx(ab, path.basename(abs));
  const filters = extractFiltersFromTwbx(ab, path.basename(abs));
  const sql = extractSqlFromTwbx(ab, path.basename(abs));
  const dashboards = extractDashboardsFromTwbx(ab, path.basename(abs));
  return { result, audit: auditWorkbook({ result, filters, sql, dashboards }), dashboards, filters };
}

describe('scratch', () => {
  it('demo dead list', () => {
    const { audit: a, dashboards, result } = load(DEMO);
    fs.writeFileSync('/private/tmp/claude-501/-Users-saikiran-andey-Downloads/5a461f6a-025f-4f10-aaa6-490ea70ccaf0/scratchpad/out.json', JSON.stringify({
      dead: a.dead, pct: a.dead_weight_pct, limited: a.limited,
      params: result.parameters.map((p) => p.name),
      dash: dashboards.dashboards.map((d) => [d.name, d.hidden, d.sizing, d.size]),
      ws: result.worksheets?.map((w) => [w.name, w.fields.length]),
      lint: a.lint.map((l) => [l.rule, l.subject]),
    }, null, 1));
  });
});
