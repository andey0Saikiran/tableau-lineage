// Node parity/regression test for the client-side extractor.
// Polyfills DOMParser with @xmldom/xmldom and runs the real extractor against
// the owner's sample workbooks, asserting the two correctness fixes.
//
// Run: npm run test:core   (Node >= 22.6, uses --experimental-strip-types)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';

// The extractor calls `new DOMParser()` at runtime — provide one for Node.
(globalThis as unknown as { DOMParser: unknown }).DOMParser = DOMParser;

const { extractFromTwbx, extractFromXml } = await import('../src/lib/extractor.ts');

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');

function load(file: string): ReturnType<typeof extractFromTwbx> {
  const buf = fs.readFileSync(path.join(FIXTURES, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return extractFromTwbx(ab, file);
}

let failures = 0;
function check(label: string, cond: boolean, detail = ''): void {
  const tag = cond ? '  ✅' : '  ❌';
  console.log(`${tag} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
}

console.log('\n=== Tableau lineage extractor — parity & regression tests ===\n');

// ── Workbook A: dashboard.twbx (table-calc false-positive case) ───────────────
{
  console.log('table-calc.twbx');
  const r = load('table-calc.twbx');
  console.log('  stats:', JSON.stringify(r.stats));
  const byName = new Map(r.fields.map((f) => [f.field_name, f]));

  // FIX 2: a field dividing by [total_views] must NOT be flagged a table calc
  // just because "TOTAL" is a substring of the raw field name.
  const falsePositives = r.fields.filter(
    (f) => f.is_table_calc && !/\b(WINDOW_|RUNNING_|LOOKUP|FIRST|LAST|INDEX|SIZE|RANK|PREVIOUS_VALUE|TOTAL|SCRIPT_)\w*\s*\(/i.test(f.formula),
  );
  check('FIX 2: no table-calc false positives from substring matches', falsePositives.length === 0,
    falsePositives.map((f) => f.field_name).join(', '));

  // A genuine WINDOW_/RUNNING_ table calc, if present, IS flagged.
  const realTableCalc = r.fields.find((f) => /\bWINDOW_\w+\s*\(/i.test(f.formula));
  if (realTableCalc) {
    check('genuine WINDOW_* table calc is detected', realTableCalc.is_table_calc === true,
      realTableCalc.field_name);
  }
  check('extracted at least one calculated field', r.fields.length > 0, `${r.fields.length} fields`);
  void byName;
}

// ── Workbook C: dashboard (10).twbx (parameter caption-resolution case) ───────
{
  console.log('\nwith-params.twbx');
  const r = load('with-params.twbx');
  console.log('  stats:', JSON.stringify(r.stats));
  console.log('  parameters:', r.parameters.map((p) => `${p.name} (name=${p.internal_name})`).join('; '));

  // FIX 1: no calculated field should carry a phantom "Parameters" dependency,
  // and no raw field should be literally "Parameters".
  const phantom = r.fields.filter((f) => f.ingredients.includes('Parameters'));
  check('FIX 1: no phantom "Parameters" ingredient', phantom.length === 0,
    phantom.map((f) => f.field_name).join(', '));
  check('FIX 1: "Parameters" not a raw field', !r.rawFields.includes('Parameters'));

  // FIX 1: at least one field actually resolves a parameter dependency.
  const withParamDep = r.fields.filter((f) => f.parameter_dependencies.length > 0);
  check('FIX 1: parameter references resolve to a param dependency',
    withParamDep.length > 0,
    `${withParamDep.length} fields reference params`);

  // No formula should still contain an unresolved "[Parameters]." qualifier.
  const unresolved = r.fields.filter((f) => /\[Parameters\]\./i.test(f.formula));
  check('FIX 1: no unresolved [Parameters]. qualifier left in formulas',
    unresolved.length === 0, unresolved.map((f) => f.field_name).join(', '));

  check('parameters were extracted', r.parameters.length > 0, `${r.parameters.length} params`);
}

// ── Synthetic XML: exercises LOD (no real sample has one) + edge cases ────────
{
  console.log('\nsynthetic.twb (LOD / table-calc / param-by-caption)');
  const xml = `<?xml version="1.0"?>
  <workbook>
    <datasources>
      <datasource name="Parameters">
        <column name="[Threshold Internal]" caption="Sales Threshold" datatype="integer" value="100" param-domain-type="range"><calculation class="tableau" formula="100"/></column>
      </datasource>
      <datasource caption="Orders" name="federated.abc">
        <column name="[Sales]" caption="Sales" datatype="real"/>
        <column name="[Region]" caption="Region" datatype="string"/>
        <column name="[Profit]" caption="Profit" datatype="real"/>
        <column name="[total_views]" caption="total_views" datatype="integer"/>
        <column name="[Adds]" caption="Adds" datatype="integer"/>
        <column name="[Profit Ratio]" caption="Profit Ratio" datatype="real"><calculation class="tableau" formula="SUM([Profit])/SUM([Sales])"/></column>
        <column name="[Sales per Region]" caption="Sales per Region" datatype="real"><calculation class="tableau" formula="{ FIXED [Region] : SUM([Sales]) }"/></column>
        <column name="[Running Total]" caption="Running Total" datatype="real"><calculation class="tableau" formula="RUNNING_SUM(SUM([Sales]))"/></column>
        <column name="[Conversion]" caption="Conversion" datatype="real"><calculation class="tableau" formula="SUM([Adds])/SUM([total_views])"/></column>
        <column name="[Above Threshold]" caption="Above Threshold" datatype="boolean"><calculation class="tableau" formula="[Sales] &gt; [Parameters].[Sales Threshold]"/></column>
      </datasource>
    </datasources>
  </workbook>`;
  const r = extractFromXml(xml, 'synthetic');
  console.log('  stats:', JSON.stringify(r.stats));
  const by = new Map(r.fields.map((f) => [f.field_name, f]));
  check('LOD: { FIXED ... } detected as lod_type=FIXED', by.get('Sales per Region')?.lod_type === 'FIXED');
  check('LOD: field_type is "lod"', by.get('Sales per Region')?.field_type === 'lod');
  check('table calc: RUNNING_SUM detected', by.get('Running Total')?.is_table_calc === true);
  check('FIX 2: total_views NOT a table calc', by.get('Conversion')?.is_table_calc === false);
  check('plain calc classified "calculated"', by.get('Profit Ratio')?.field_type === 'calculated');
  check('FIX 1: param-by-caption resolves to dep', by.get('Above Threshold')?.parameter_dependencies.includes('Sales Threshold') === true);
  check('FIX 1: no phantom Parameters dep', by.get('Above Threshold')?.ingredients.includes('Parameters') === false);
  check('stats: lod_fields=1, table_calcs=1', r.stats.lod_fields === 1 && r.stats.table_calcs === 1, JSON.stringify({ lod: r.stats.lod_fields, tc: r.stats.table_calcs }));
}

// ── Synthetic XML: parameter vs field NAME COLLISION (FIX 3) ──────────────────
{
  console.log('\nsynthetic-collision.twb (param name == field caption)');
  const xml = `<?xml version="1.0"?>
  <workbook><datasources>
    <datasource name="Parameters">
      <column name="[Discount]" caption="Discount" datatype="real" value="0.1" param-domain-type="range"><calculation class="tableau" formula="0.1"/></column>
    </datasource>
    <datasource caption="Orders" name="federated.x">
      <column name="[Sales]" caption="Sales" datatype="real"/>
      <column name="[Discount]" caption="Discount" datatype="real"/>
      <column name="[Net]" caption="Net" datatype="real"><calculation class="tableau" formula="[Sales] * (1 - [Discount])"/></column>
      <column name="[Adj]" caption="Adj" datatype="real"><calculation class="tableau" formula="[Discount] - [Parameters].[Discount]"/></column>
    </datasource>
  </datasources></workbook>`;
  const r = extractFromXml(xml, 'collision');
  const by = new Map(r.fields.map((f) => [f.field_name, f]));
  // [Net] uses the FIELD [Discount] (bare) — must stay an ingredient, not a param.
  check('collision: bare [Discount] kept as field ingredient',
    by.get('Net')?.ingredients.includes('Discount') === true);
  check('collision: bare [Discount] NOT misfiled as a param dep',
    by.get('Net')?.parameter_dependencies.includes('Discount') === false);
  // [Adj] uses BOTH the field (bare) and the param ([Parameters].[Discount]).
  check('collision: [Adj] keeps field edge to Discount',
    by.get('Adj')?.ingredients.includes('Discount') === true);
  check('collision: [Adj] keeps param edge to Discount',
    by.get('Adj')?.parameter_dependencies.includes('Discount') === true);
  // Stored formula must be clean: human-readable, no sentinel, no [Parameters].
  const adjFormula = by.get('Adj')?.formula ?? '';
  check('collision: stored formula is clean & readable',
    adjFormula === '[Discount] - [Discount]' && !adjFormula.includes('[Parameters].') && !adjFormula.includes(String.fromCharCode(1)),
    JSON.stringify(adjFormula));
}

console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===\n`);
process.exit(failures === 0 ? 0 : 1);
