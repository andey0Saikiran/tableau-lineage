import { describe, expect, it } from 'vitest';
import { extractFromXml } from '../src/lib/extractor';
import { auditWorkbook } from '../src/lib/audit';

/**
 * Caption resolution must be scoped to the data source that owns the formula.
 *
 * Two data sources routinely declare the same internal column name: a dev and a
 * prod extract, or 2023 and 2024 of the same table. A single document-wide
 * last-write-wins map stamped one data source's caption into the other's
 * formulas, which printed a formula the workbook does not contain, pointed the
 * lineage edge at a data source the calculation never touches, and left the real
 * column looking unreferenced so the audit reported it as safe to delete.
 */
function wb(body: string): string {
  return `<?xml version='1.0' encoding='utf-8' ?>
<workbook version='18.1'><datasources>${body}</datasources>
<worksheets><worksheet name='Sheet 1'><table><view>
  <datasource-dependencies datasource='ds.a'>
    <column caption='A Total' datatype='real' name='[Calculation_A]' />
  </datasource-dependencies>
</view></table></worksheet></worksheets></workbook>`;
}

describe('cross-datasource column-name collision', () => {
  const twoCaptions = wb(`
    <datasource caption='Sales A' name='ds.a'>
      <column caption='Gross Sales' datatype='real' name='[sales]' role='measure' />
      <column caption='A Total' datatype='real' name='[Calculation_A]'>
        <calculation class='tableau' formula='SUM([sales])' />
      </column>
    </datasource>
    <datasource caption='Sales B' name='ds.b'>
      <column caption='Net Sales' datatype='real' name='[sales]' role='measure' />
    </datasource>`);

  it('resolves a formula against its own data source, not the last one in the file', () => {
    const r = extractFromXml(twoCaptions, 'collide');
    const f = r.fields.find((x) => x.field_name === 'A Total')!;
    expect(f.formula).toBe('SUM([Gross Sales])');
    expect(f.ingredients).toEqual(['Gross Sales']);
  });

  it('does not report a column used by a live calculation as unused', () => {
    const r = extractFromXml(twoCaptions, 'collide');
    const audit = auditWorkbook({ result: r });
    const dead = audit.dead.map((d) => `${d.datasource}/${d.name}`);
    expect(dead).not.toContain('Sales A/Gross Sales');
  });

  it('holds when only the other data source renamed its column', () => {
    // The more common shape: one side has no caption at all.
    const oneCaption = wb(`
      <datasource caption='Orders 2023' name='ds.a'>
        <column datatype='real' name='[amount]' role='measure' />
        <column caption='A Total' datatype='real' name='[Calculation_A]'>
          <calculation class='tableau' formula='SUM([amount])' />
        </column>
      </datasource>
      <datasource caption='Orders 2024' name='ds.b'>
        <column caption='Net Amount' datatype='real' name='[amount]' role='measure' />
      </datasource>`);
    const f = extractFromXml(oneCaption, 'x').fields.find((x) => x.field_name === 'A Total')!;
    expect(f.formula).toBe('SUM([amount])');
    expect(f.ingredients).toEqual(['amount']);
  });

  it('does not chain replacements within a single data source', () => {
    // [a] -> 'Revenue', and a separate column literally named [Revenue].
    // A sequential split/join loop rewrote SUM([a]) to SUM([Revenue Final]).
    const chained = wb(`
      <datasource caption='One' name='ds.a'>
        <column caption='Revenue' datatype='real' name='[a]' role='measure' />
        <column caption='Revenue Final' datatype='real' name='[Revenue]' role='measure' />
        <column caption='A Total' datatype='real' name='[Calculation_A]'>
          <calculation class='tableau' formula='SUM([a])' />
        </column>
      </datasource>`);
    const f = extractFromXml(chained, 'x').fields.find((x) => x.field_name === 'A Total')!;
    expect(f.formula).toBe('SUM([Revenue])');
  });

  it('resolves in one pass, so output cannot expand multiplicatively', () => {
    // Captions that each contain other internal names used to grow the formula
    // on every loop iteration until the tab ran out of memory.
    const cols = Array.from({ length: 40 }, (_, i) =>
      `<column caption='[c${i}] and [c${i + 1}] expanded' datatype='real' name='[c${i}]' />`,
    ).join('');
    const bomb = wb(`
      <datasource caption='Bomb' name='ds.a'>
        ${cols}
        <column caption='A Total' datatype='real' name='[Calculation_A]'>
          <calculation class='tableau' formula='SUM([c0])' />
        </column>
      </datasource>`);
    const started = Date.now();
    const f = extractFromXml(bomb, 'x').fields.find((x) => x.field_name === 'A Total')!;
    expect(Date.now() - started).toBeLessThan(2000);
    expect(f.formula.length).toBeLessThan(200);
  });
});
