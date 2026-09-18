import { describe, expect, it } from 'vitest';
import { headline } from '../src/components/ConnectCard';
import type { AuditResult } from '../src/lib/audit';

// The card sits directly above the audit panel, so its headline must never
// claim more than the audit actually established.
function audit(over: Partial<AuditResult> = {}): AuditResult {
  return {
    dead: [],
    dead_by_confidence: { unused: 0, 'likely-unused': 0, 'referenced-in-comment': 0 },
    dead_weight_pct: 0,
    duplicates: [],
    lint: [],
    lint_by_severity: { high: 0, medium: 0, low: 0 },
    limited: false,
    limitations: [],
    ...over,
  };
}
type Dead = AuditResult['dead'][number];
const dead = (n: number, over: Partial<Dead> = {}): Dead[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `f${i}`, datasource: 'ds', kind: 'calculated' as const,
    confidence: 'unused' as const, reason: 'r', hidden: false, ...over,
  }));
const likelyParam = (n: number) => dead(n, { kind: 'parameter', confidence: 'likely-unused' });
const group = { signature: 's', members: [], kind: 'identical-formula' as const };

describe('ConnectCard headline', () => {
  it('makes no claim when the audit did not run', () => {
    expect(headline(null)).toBe('The lineage for this workbook is below.');
  });

  it('never calls a workbook clean when part of the audit could not run', () => {
    const h = headline(audit({ limited: true }));
    expect(h).not.toMatch(/clean/i);
    expect(h).toMatch(/could not run/);
  });

  it('names the sections that failed instead of calling the workbook clean', () => {
    // A failed section renders no panel, so the card must say what was skipped.
    expect(headline(audit(), ['SQL'])).toBe(
      'Could not read the SQL in this workbook, so those checks were skipped.',
    );
    expect(headline(audit(), ['SQL', 'filters', 'dashboards'])).toBe(
      'Could not read the SQL, filters and dashboards in this workbook, so those checks were skipped.',
    );
  });

  it('never says definitely unused when a failed section could hide a usage', () => {
    // SQL and filters are reachability roots: if either failed, a field used
    // only there comes back "unused" from the audit.
    expect(headline(audit({ dead: dead(2) }), ['SQL'])).toBe(
      'Found 2 likely unused fields in this workbook.',
    );
  });

  it('calls a workbook clean only when every check ran and found nothing', () => {
    expect(headline(audit())).toBe('This workbook came back clean.');
  });

  it('hedges and names parameters instead of calling everything an unused field', () => {
    expect(headline(audit({ dead: likelyParam(2) }))).toBe(
      'Found 2 likely unused parameters in this workbook.',
    );
    expect(headline(audit({ dead: [...dead(3), ...likelyParam(1)] }))).toBe(
      'Found 4 likely unused fields and parameters in this workbook.',
    );
  });

  it('counts unused fields with correct plurals', () => {
    expect(headline(audit({ dead: dead(1) }))).toBe('Found 1 unused field in this workbook.');
    expect(headline(audit({ dead: dead(7) }))).toBe('Found 7 unused fields in this workbook.');
  });

  it('counts duplicates in groups, the same unit the audit panel uses', () => {
    expect(headline(audit({ duplicates: [group] }))).toBe(
      'Found 1 group of duplicate calculations in this workbook.',
    );
    expect(headline(audit({ duplicates: [group, group] }))).toBe(
      'Found 2 groups of duplicate calculations in this workbook.',
    );
  });
});
