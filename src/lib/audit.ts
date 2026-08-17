// Workbook audit: the "what should I clean up?" layer built on top of the
// lineage extract. Everything here is derived from data already parsed out of
// the .twb, so it runs client-side with no network and no extra file reads.
//
// Design rule for the dead-weight report: NEVER overstate confidence. A field
// wrongly labelled "safe to delete" is the one mistake that destroys trust in
// the tool, so anything the parser cannot see through (a sheet we failed to
// read, a name we could not resolve) downgrades the verdict rather than
// guessing.

import type { ExtractResult } from './types';
import type { FilterExtractResult } from './filterExtractor';
import type { SqlExtractResult } from './sqlExtractor';
import type { DashboardExtractResult, ProvenanceExtractResult } from './dashboardExtractor';

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Comparable form of a field name: de-bracketed, trimmed, case-folded. */
export function norm(name: string): string {
  return name.trim().replace(/^\[|\]$/g, '').toLowerCase();
}

export type DeadConfidence = 'unused' | 'likely-unused' | 'referenced-in-comment';

export interface DeadField {
  name: string;
  datasource: string;
  kind: 'calculated' | 'column' | 'parameter';
  confidence: DeadConfidence;
  /** Plain-English reason, shown verbatim in the UI. */
  reason: string;
  hidden: boolean;
}

export interface DuplicateGroup {
  /** The formula the members share, normalized for comparison. */
  signature: string;
  members: { name: string; datasource: string; formula: string }[];
  kind: 'identical-formula' | 'same-name-different-formula';
}

export type LintSeverity = 'high' | 'medium' | 'low';

export interface LintFinding {
  rule: string;
  severity: LintSeverity;
  title: string;
  detail: string;
  /** Where it was found: field name, sheet name, or data source. */
  subject: string;
  /** The offending formula or setting, when there is one to show. */
  evidence?: string;
  fix: string;
}

export interface AuditResult {
  dead: DeadField[];
  dead_by_confidence: Record<DeadConfidence, number>;
  /** Share of inspectable fields that are unused, 0-100, rounded. */
  dead_weight_pct: number;
  duplicates: DuplicateGroup[];
  lint: LintFinding[];
  lint_by_severity: Record<LintSeverity, number>;
  /** True when parsing gaps mean the dead list may be incomplete. */
  limited: boolean;
  limitations: string[];
}

export interface AuditInput {
  result: ExtractResult;
  filters?: FilterExtractResult | null;
  sql?: SqlExtractResult | null;
  dashboards?: DashboardExtractResult | null;
  provenance?: ProvenanceExtractResult | null;
}

// ── Dead weight ───────────────────────────────────────────────────────────────

/**
 * A field is "reachable" if a worksheet uses it, a filter acts on it, SQL
 * mentions it, or any reachable calculation depends on it (transitively).
 * Everything else is dead weight.
 */
function computeReachable(input: AuditInput): { reachable: Set<string>; commentOnly: Set<string> } {
  const { result, filters, sql } = input;
  const reachable = new Set<string>();
  const queue: string[] = [];

  const push = (name: string) => {
    const k = norm(name);
    if (k && !reachable.has(k)) {
      reachable.add(k);
      queue.push(k);
    }
  };

  // Roots: anything a worksheet renders or filters on.
  for (const ws of result.worksheets ?? []) {
    for (const f of ws.fields) push(f);
    for (const flt of ws.filters) push(flt.field);
  }
  for (const f of filters?.filters ?? []) push(f.field);

  // Roots: anything named in stored SQL (custom SQL can reference columns the
  // rest of the workbook never mentions).
  for (const q of sql?.custom_sql ?? []) {
    for (const col of result.allColumns) {
      if (new RegExp(`\\b${escapeRe(col.name)}\\b`, 'i').test(q.sql)) push(col.name);
    }
  }
  for (const f of sql?.rawsql_calculations ?? []) push(f.field_name);

  // Walk upstream: a used calculation keeps everything it depends on alive.
  const calcsByName = new Map<string, ExtractResult['fields']>();
  for (const f of result.fields) {
    const k = norm(f.field_name);
    if (!calcsByName.has(k)) calcsByName.set(k, []);
    calcsByName.get(k)!.push(f);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const calc of calcsByName.get(cur) ?? []) {
      for (const ing of calc.ingredients) push(ing);
      for (const p of calc.parameter_dependencies) push(p);
    }
  }

  // Names that appear ONLY inside a comment or string. Those are not real
  // dependencies (Stage 1 strips them), but they signal deliberate deprecation,
  // so the report says so instead of a flat "unused".
  const commentOnly = new Set<string>();
  for (const calc of result.fields) {
    const stripped = new Set(calc.ingredients.map(norm));
    for (const m of calc.formula.matchAll(/\[([^\]]+)\]/g)) {
      const k = norm(m[1]);
      if (k && !stripped.has(k) && !reachable.has(k)) commentOnly.add(k);
    }
  }

  return { reachable, commentOnly };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDeadWeight(input: AuditInput): {
  dead: DeadField[];
  limited: boolean;
  limitations: string[];
} {
  const { result } = input;
  const limitations: string[] = [];

  // Without worksheet data there are no usage roots, so everything would look
  // dead. Refuse to report rather than produce a dangerously wrong list.
  const worksheets = result.worksheets ?? [];
  if (worksheets.length === 0) {
    limitations.push(
      'No worksheets could be read from this workbook, so field usage cannot be determined. Dead-weight analysis is unavailable.',
    );
    return { dead: [], limited: true, limitations };
  }

  const { reachable, commentOnly } = computeReachable(input);
  const dead: DeadField[] = [];

  const calcNames = new Set(result.fields.map((f) => norm(f.field_name)));

  // Calculated fields.
  for (const f of result.fields) {
    const k = norm(f.field_name);
    if (reachable.has(k)) continue;
    dead.push({
      name: f.field_name,
      datasource: f.datasource,
      kind: 'calculated',
      confidence: commentOnly.has(k) ? 'referenced-in-comment' : 'unused',
      reason: commentOnly.has(k)
        ? 'Only referenced from a commented-out or quoted part of another formula, so Tableau never evaluates it.'
        : 'No worksheet uses it and no other calculation depends on it.',
      hidden: false,
    });
  }

  // Plain columns (the category the old extractor could not see at all).
  for (const col of result.allColumns) {
    const k = norm(col.name);
    if (col.is_calculated || calcNames.has(k) || reachable.has(k)) continue;
    dead.push({
      name: col.name,
      datasource: col.datasource,
      kind: 'column',
      confidence: commentOnly.has(k) ? 'referenced-in-comment' : 'unused',
      reason: col.hidden
        ? 'Hidden in the data pane and referenced by nothing in the workbook.'
        : 'No worksheet, filter, or calculation references this column.',
      hidden: col.hidden,
    });
  }

  // Parameters.
  //
  // A parameter is unreachable either because nothing references it at all, or
  // because everything that references it is itself unused. Those are different
  // facts and the second one is the common case, so say which. Reporting "not
  // used by any calculation" for a parameter that four live calculations
  // reference is simply false, and it hides the more useful finding: the whole
  // chain is dead and can go together.
  for (const p of result.parameters) {
    const k = norm(p.name);
    if (reachable.has(k)) continue;
    const usedBy = result.fields
      .filter((f) => f.parameter_dependencies.some((d) => norm(d) === k))
      .map((f) => f.field_name);
    const chain =
      usedBy.length > 0
        ? `Referenced only by ${usedBy.slice(0, 3).map((n) => `"${n}"`).join(', ')}` +
          `${usedBy.length > 3 ? ` and ${usedBy.length - 3} more` : ''}, ` +
          `${usedBy.length === 1 ? 'which is itself unused' : 'which are themselves unused'}, ` +
          'so the whole chain is dead weight.'
        : 'Nothing in the workbook references this parameter.';
    dead.push({
      name: p.name,
      datasource: 'Parameters',
      kind: 'parameter',
      confidence: 'likely-unused',
      reason:
        `${chain} Parameters can also be wired to dashboard actions, which are not inspected, so confirm before deleting.`,
      hidden: false,
    });
  }

  return { dead, limited: false, limitations };
}

// ── Duplicate calculations ────────────────────────────────────────────────────

/** Formula reduced to a comparison key: case, whitespace and brackets ignored. */
export function formulaSignature(formula: string): string {
  return formula
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),*/+\-<>=])\s*/g, '$1')
    .trim()
    .toLowerCase();
}

function findDuplicates(result: ExtractResult): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  // Same formula under different names: consolidation candidates.
  const bySignature = new Map<string, ExtractResult['fields']>();
  for (const f of result.fields) {
    if (!f.formula.trim()) continue;
    const sig = formulaSignature(f.formula);
    if (!bySignature.has(sig)) bySignature.set(sig, []);
    bySignature.get(sig)!.push(f);
  }
  for (const [sig, members] of bySignature) {
    if (members.length < 2) continue;
    groups.push({
      signature: sig,
      kind: 'identical-formula',
      members: members.map((m) => ({ name: m.field_name, datasource: m.datasource, formula: m.formula })),
    });
  }

  // Same name, DIFFERENT formula: the more dangerous case, because two sheets
  // showing "Revenue" may be computing different numbers.
  const byName = new Map<string, ExtractResult['fields']>();
  for (const f of result.fields) {
    const k = norm(f.field_name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(f);
  }
  for (const [, members] of byName) {
    if (members.length < 2) continue;
    const sigs = new Set(members.map((m) => formulaSignature(m.formula)));
    if (sigs.size < 2) continue; // identical ones are already reported above
    groups.push({
      signature: members[0].field_name,
      kind: 'same-name-different-formula',
      members: members.map((m) => ({ name: m.field_name, datasource: m.datasource, formula: m.formula })),
    });
  }

  return groups;
}

// ── Performance lint ──────────────────────────────────────────────────────────

const TABLE_CALC_RE =
  /\b(LOOKUP|RUNNING_(SUM|AVG|MIN|MAX|COUNT)|WINDOW_\w+|FIRST|LAST|INDEX|SIZE|RANK\w*|PREVIOUS_VALUE|TOTAL|SCRIPT_\w+)\s*\(/i;

/** Nesting depth of LOD braces, e.g. `{FIXED a : SUM({FIXED b : ...})}` = 2. */
function lodDepth(formula: string): number {
  let depth = 0;
  let max = 0;
  for (let i = 0; i < formula.length; i++) {
    if (formula[i] === '{') {
      depth++;
      max = Math.max(max, depth);
    } else if (formula[i] === '}') depth = Math.max(0, depth - 1);
  }
  return max;
}

/** How many calculation hops deep this field sits (cycle-safe). */
function calcDepth(
  name: string,
  calcsByName: Map<string, ExtractResult['fields']>,
  seen = new Set<string>(),
): number {
  const k = norm(name);
  if (seen.has(k)) return 0;
  seen.add(k);
  const calcs = calcsByName.get(k);
  if (!calcs || !calcs.length) return 0;
  let deepest = 0;
  for (const ing of calcs[0].ingredients) {
    deepest = Math.max(deepest, calcDepth(ing, calcsByName, seen));
  }
  return deepest + 1;
}

function runLint(input: AuditInput): LintFinding[] {
  const { result, filters, sql } = input;
  const out: LintFinding[] = [];
  const add = (f: LintFinding) => out.push(f);

  const calcsByName = new Map<string, ExtractResult['fields']>();
  for (const f of result.fields) {
    const k = norm(f.field_name);
    if (!calcsByName.has(k)) calcsByName.set(k, []);
    calcsByName.get(k)!.push(f);
  }

  for (const f of result.fields) {
    const formula = f.formula ?? '';

    if (f.lod_type) {
      const depth = lodDepth(formula);
      if (depth >= 2) {
        add({
          rule: 'nested-lod',
          severity: 'high',
          title: 'Nested level-of-detail expression',
          detail: `${depth} levels of LOD braces. Nested LODs force Tableau to build a query per level and are a common cause of slow workbooks.`,
          subject: f.field_name,
          evidence: formula,
          fix: 'Materialise the inner LOD in the data source, or restructure so only one level of aggregation is needed.',
        });
      }
    }

    if (TABLE_CALC_RE.test(formula) && f.ingredients.length >= 4) {
      add({
        rule: 'wide-table-calc',
        severity: 'medium',
        title: 'Table calculation over many inputs',
        detail: `Table calculations run in the browser after the query returns; this one depends on ${f.ingredients.length} fields.`,
        subject: f.field_name,
        evidence: formula,
        fix: 'Aggregate earlier (in the data source or an LOD) so less data reaches the table calculation.',
      });
    }

    if (formula.length > 1000) {
      add({
        rule: 'very-long-calc',
        severity: 'medium',
        title: 'Very long calculation',
        detail: `${formula.length} characters. Long calculations are hard to maintain and often hide repeated logic.`,
        subject: f.field_name,
        fix: 'Split into named intermediate calculations that can be reused and tested.',
      });
    }

    const nestedIfs = (formula.match(/\bIF\b/gi) || []).length;
    if (nestedIfs >= 6) {
      add({
        rule: 'deep-conditional',
        severity: 'low',
        title: 'Many branches in one calculation',
        detail: `${nestedIfs} IF branches. Long conditional chains evaluate in order for every row.`,
        subject: f.field_name,
        evidence: formula.slice(0, 400),
        fix: 'Use CASE where the test is a single field, or move the mapping into the data source as a lookup.',
      });
    }

    // String work is materially more expensive than numeric or boolean work.
    if (/\b(CONTAINS|FIND|REGEXP_\w+|MID|LEFT|RIGHT|REPLACE)\s*\(/i.test(formula) && f.field_type !== 'raw') {
      add({
        rule: 'string-calc',
        severity: 'low',
        title: 'String operation in a calculation',
        detail: 'String comparisons are among the slowest operations in Tableau, especially over large extracts.',
        subject: f.field_name,
        evidence: formula.slice(0, 200),
        fix: 'Precompute the result as a boolean or integer flag in the data source where possible.',
      });
    }

    const depth = calcDepth(f.field_name, calcsByName);
    if (depth >= 5) {
      add({
        rule: 'deep-calc-chain',
        severity: 'medium',
        title: 'Deeply chained calculation',
        detail: `${depth} calculation hops from raw columns. Deep chains are hard to debug and every layer is recomputed.`,
        subject: f.field_name,
        fix: 'Flatten intermediate steps that exist only to be referenced once.',
      });
    }
  }

  // Filter-level rules.
  if (filters) {
    const perSheet = new Map<string, number>();
    for (const f of filters.filters) {
      for (const ws of f.worksheets) perSheet.set(ws, (perSheet.get(ws) ?? 0) + 1);
    }
    // Reported once for the whole workbook, not once per sheet: the same
    // filter set applied to twenty sheets is one problem, and twenty findings
    // would bury everything else.
    const heavy = [...perSheet.entries()].filter(([, c]) => c >= 6).sort((a, b) => b[1] - a[1]);
    if (heavy.length) {
      const worst = heavy[0];
      const names = heavy.slice(0, 5).map(([s, c]) => `${s} (${c})`).join(', ');
      add({
        rule: 'many-filters',
        severity: 'medium',
        title:
          heavy.length === 1
            ? 'Many filters on one worksheet'
            : `Many filters on ${heavy.length} worksheets`,
        detail: `Up to ${worst[1]} filters per sheet. Each filter adds work to every query the sheet runs.`,
        subject: heavy.length === 1 ? worst[0] : `${heavy.length} worksheets`,
        evidence: names + (heavy.length > 5 ? `, +${heavy.length - 5} more` : ''),
        fix: 'Use context filters for the ones that narrow the data most, or move stable filters into the data source.',
      });
    }

    const contextCount = filters.filters.filter((f) => f.is_context).length;
    if (filters.count >= 5 && contextCount === 0) {
      add({
        rule: 'no-context-filter',
        severity: 'low',
        title: 'No context filters',
        detail: `${filters.count} filters and none are context filters, so none of them reduce the data other filters scan.`,
        subject: 'Workbook',
        fix: 'Promote the most selective filter to a context filter.',
      });
    }
  }

  // Connection-level rules.
  if (sql) {
    for (const q of sql.custom_sql) {
      add({
        rule: 'custom-sql',
        severity: 'medium',
        title: 'Custom SQL data source',
        detail:
          'Custom SQL is wrapped as a subquery in every query Tableau sends, which blocks join culling and other optimisations.',
        subject: q.datasource,
        evidence: q.sql.slice(0, 300),
        fix: 'Replace with the table/join builder, or materialise the query as a view or extract.',
      });
    }
    for (const s of sql.initial_sql) {
      add({
        rule: 'initial-sql',
        severity: 'low',
        title: 'Initial SQL runs on every connection',
        detail: 'Initial SQL executes each time the workbook connects, adding latency before any data is returned.',
        subject: s.datasource,
        evidence: s.sql,
        fix: 'Keep it minimal, or move the setup into the database itself.',
      });
    }
  }

  // Dashboard rules.
  const dashboards = input.dashboards;
  if (dashboards) {
    for (const d of dashboards.dashboards) {
      // Automatic/range sizing makes Tableau re-layout per client viewport.
      if (d.sizing && d.sizing !== 'fixed' && !d.size) {
        add({
          rule: 'non-fixed-dashboard',
          severity: 'medium',
          title: 'Dashboard is not fixed size',
          detail: `"${d.name}" uses ${d.sizing} sizing, so Tableau recomputes the layout for every client viewport instead of caching one image.`,
          subject: d.name,
          fix: 'Set a fixed dashboard size, and add device layouts for phone or tablet if needed.',
        });
      }
      if (d.worksheets.length >= 10) {
        add({
          rule: 'dense-dashboard',
          severity: 'medium',
          title: 'Many worksheets on one dashboard',
          detail: `"${d.name}" places ${d.worksheets.length} sheets. Every sheet issues its own queries when the dashboard loads.`,
          subject: d.name,
          evidence: d.worksheets.slice(0, 8).join(', ') + (d.worksheets.length > 8 ? ', …' : ''),
          fix: 'Combine sheets that share a query, or move detail onto a drill-down dashboard.',
        });
      }
    }

    // Sheets that exist but appear on no dashboard still load with the workbook.
    if (dashboards.dashboards.length > 0 && dashboards.orphanWorksheets.length > 0) {
      add({
        rule: 'orphan-worksheets',
        severity: 'low',
        title: 'Worksheets on no dashboard',
        detail: `${dashboards.orphanWorksheets.length} worksheet${dashboards.orphanWorksheets.length === 1 ? '' : 's'} are not placed on any dashboard, yet still open with the workbook.`,
        subject: 'Workbook',
        evidence:
          dashboards.orphanWorksheets.slice(0, 8).join(', ') +
          (dashboards.orphanWorksheets.length > 8 ? ', …' : ''),
        fix: 'Delete the ones that are no longer needed, or move scratch sheets to a separate workbook.',
      });
    }
  }

  // Provenance rules.
  for (const ds of input.provenance?.datasources ?? []) {
    if (!ds.isExtract && ds.connections.some((c) => !c.published)) {
      add({
        rule: 'live-connection',
        severity: 'low',
        title: 'Live connection',
        detail: `"${ds.name}" queries the database directly, so every interaction waits on ${ds.connections.map((c) => c.class).join(', ')}.`,
        subject: ds.name,
        fix: 'Use an extract if the data does not need to be real time; extracts are usually far faster.',
      });
    }
  }

  // Workbook-shape rules.
  const sheetCount = (result.worksheets ?? []).length;
  if (sheetCount >= 20) {
    add({
      rule: 'many-worksheets',
      severity: 'medium',
      title: 'Large number of worksheets',
      detail: `${sheetCount} worksheets. Every sheet in a workbook is loaded when it opens, even if no dashboard shows it.`,
      subject: 'Workbook',
      fix: 'Split rarely used sheets into a separate workbook, or delete sheets that no dashboard uses.',
    });
  }

  const severityRank: Record<LintSeverity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.rule.localeCompare(b.rule));
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function auditWorkbook(input: AuditInput): AuditResult {
  const { dead, limited, limitations } = findDeadWeight(input);
  const duplicates = findDuplicates(input.result);
  const lint = runLint(input);

  const dead_by_confidence: Record<DeadConfidence, number> = {
    unused: 0,
    'likely-unused': 0,
    'referenced-in-comment': 0,
  };
  for (const d of dead) dead_by_confidence[d.confidence]++;

  const lint_by_severity: Record<LintSeverity, number> = { high: 0, medium: 0, low: 0 };
  for (const f of lint) lint_by_severity[f.severity]++;

  // Denominator is everything the audit can actually see, so the percentage
  // never flatters itself by ignoring columns it failed to inspect.
  const inspectable =
    input.result.allColumns.length + input.result.parameters.length || input.result.fields.length;
  const dead_weight_pct = inspectable > 0 ? Math.round((dead.length / inspectable) * 100) : 0;

  return {
    dead: dead.sort(
      (a, b) => a.datasource.localeCompare(b.datasource) || a.name.localeCompare(b.name),
    ),
    dead_by_confidence,
    dead_weight_pct,
    duplicates,
    lint,
    lint_by_severity,
    limited,
    limitations,
  };
}
