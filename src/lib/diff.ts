// Semantic workbook diff.
//
// Tableau workbooks live in version control as one enormous XML blob, so a git
// diff between two revisions is unreadable: layout coordinates, generated ids
// and re-serialised attributes swamp the handful of changes a human cares
// about. This compares two parsed workbooks instead of two files, so the answer
// is "these three calculations changed and here is what they break", not four
// thousand changed lines.
//
// Everything here is pure: it takes two already-parsed snapshots and returns a
// plain object, which keeps it usable from the app, the MCP server and tests.

import { formulaSignature, norm } from './audit';
import type { ExtractResult, CalculatedField, Parameter } from './types';
import type { FilterExtractResult, WorkbookFilter } from './filterExtractor';
import type { SqlExtractResult } from './sqlExtractor';
import type { DashboardExtractResult, ProvenanceExtractResult } from './dashboardExtractor';

export interface WorkbookSnapshot {
  label: string;
  result: ExtractResult;
  filters?: FilterExtractResult | null;
  sql?: SqlExtractResult | null;
  dashboards?: DashboardExtractResult | null;
  provenance?: ProvenanceExtractResult | null;
}

export interface CalcChange {
  name: string;
  datasource: string;
  beforeFormula: string;
  afterFormula: string;
  /** Fields downstream of this one that the change can affect. */
  impact: string[];
}

export interface CalcRename {
  beforeName: string;
  afterName: string;
  datasource: string;
  formula: string;
}

export interface ParamChange {
  name: string;
  before: string;
  after: string;
}

export interface FilterChange {
  field: string;
  worksheet: string;
  before: string | null;
  after: string | null;
}

export interface DashboardChange {
  name: string;
  addedSheets: string[];
  removedSheets: string[];
}

export interface DatasourceChange {
  name: string;
  detail: string;
}

export interface WorkbookDiff {
  before: string;
  after: string;
  identical: boolean;
  totalChanges: number;
  calculations: {
    added: CalculatedField[];
    removed: CalculatedField[];
    modified: CalcChange[];
    renamed: CalcRename[];
  };
  parameters: {
    added: Parameter[];
    removed: Parameter[];
    valueChanged: ParamChange[];
  };
  filters: {
    added: FilterChange[];
    removed: FilterChange[];
    changed: FilterChange[];
  };
  worksheets: { added: string[]; removed: string[] };
  dashboards: { added: string[]; removed: string[]; changed: DashboardChange[] };
  datasources: { added: string[]; removed: string[]; changed: DatasourceChange[] };
  sql: { added: string[]; removed: string[]; changed: string[] };
  /** Highest-signal changes first, for a summary line or a commit message. */
  headline: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function keyOf(f: { field_name: string; datasource: string }): string {
  return `${norm(f.datasource)}::${norm(f.field_name)}`;
}

/** Everything reachable downstream of `start` in the given field set. */
function downstreamOf(start: string, fields: CalculatedField[]): string[] {
  const dependents = new Map<string, string[]>();
  for (const f of fields) {
    for (const ing of [...f.ingredients, ...f.parameter_dependencies]) {
      const k = norm(ing);
      if (!dependents.has(k)) dependents.set(k, []);
      dependents.get(k)!.push(f.field_name);
    }
  }
  const seen = new Set<string>([norm(start)]);
  const out: string[] = [];
  const queue = [norm(start)];
  while (queue.length) {
    for (const dep of dependents.get(queue.shift()!) ?? []) {
      const k = norm(dep);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(dep);
      queue.push(k);
    }
  }
  return out.sort();
}

/** One comparable line per filter, so a changed selection is visible. */
function filterSignature(f: WorkbookFilter): string {
  const parts = [f.kind];
  if (f.is_context) parts.push('context');
  if (f.members.length) parts.push(`members: ${[...f.members].sort().join(', ')}`);
  if (f.range?.min || f.range?.max) parts.push(`range ${f.range?.min ?? '…'}–${f.range?.max ?? '…'}`);
  return parts.join(' · ');
}

function flattenFilters(r: FilterExtractResult | null | undefined): Map<string, FilterChange> {
  const out = new Map<string, FilterChange>();
  for (const f of r?.filters ?? []) {
    for (const ws of f.worksheets) {
      out.set(`${norm(ws)}::${norm(f.field)}`, {
        field: f.field,
        worksheet: ws,
        before: null,
        after: filterSignature(f),
      });
    }
  }
  return out;
}

function sqlStatements(r: SqlExtractResult | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const q of r?.custom_sql ?? []) out.set(`custom:${q.datasource}:${q.relation_name}`, q.sql);
  for (const q of r?.initial_sql ?? []) out.set(`initial:${q.datasource}`, q.sql);
  for (const p of r?.stored_procedures ?? []) out.set(`proc:${p.datasource}:${p.name}`, p.name);
  // Keyed by formula, not field name: renaming a RAWSQL calculation does not
  // change the SQL, and keying by name would report it as an add plus a remove
  // on top of the rename already reported under calculations.
  for (const f of r?.rawsql_calculations ?? []) {
    out.set(`rawsql:${f.datasource}:${formulaSignature(f.formula)}`, f.formula);
  }
  return out;
}

// ── Diff ──────────────────────────────────────────────────────────────────────

export function diffWorkbooks(before: WorkbookSnapshot, after: WorkbookSnapshot): WorkbookDiff {
  const beforeCalcs = new Map(before.result.fields.map((f) => [keyOf(f), f]));
  const afterCalcs = new Map(after.result.fields.map((f) => [keyOf(f), f]));

  const addedCalcs: CalculatedField[] = [];
  const removedCalcs: CalculatedField[] = [];
  const modified: CalcChange[] = [];

  for (const [k, f] of afterCalcs) {
    const prev = beforeCalcs.get(k);
    if (!prev) {
      addedCalcs.push(f);
    } else if (formulaSignature(prev.formula) !== formulaSignature(f.formula)) {
      // Signature comparison means reformatting a calculation is not a change.
      modified.push({
        name: f.field_name,
        datasource: f.datasource,
        beforeFormula: prev.formula,
        afterFormula: f.formula,
        impact: downstreamOf(f.field_name, after.result.fields),
      });
    }
  }
  for (const [k, f] of beforeCalcs) {
    if (!afterCalcs.has(k)) removedCalcs.push(f);
  }

  // A field that disappears and one that appears with an identical formula is
  // almost always a rename, and reporting it as add + remove hides that.
  const renamed: CalcRename[] = [];
  const removedBySig = new Map<string, CalculatedField>();
  for (const f of removedCalcs) {
    if (f.formula.trim()) removedBySig.set(formulaSignature(f.formula), f);
  }
  for (let i = addedCalcs.length - 1; i >= 0; i--) {
    const f = addedCalcs[i];
    const sig = formulaSignature(f.formula);
    const match = removedBySig.get(sig);
    if (match && f.formula.trim()) {
      renamed.push({
        beforeName: match.field_name,
        afterName: f.field_name,
        datasource: f.datasource,
        formula: f.formula,
      });
      addedCalcs.splice(i, 1);
      removedCalcs.splice(removedCalcs.indexOf(match), 1);
      removedBySig.delete(sig);
    }
  }

  // Parameters.
  const beforeParams = new Map(before.result.parameters.map((p) => [norm(p.name), p]));
  const afterParams = new Map(after.result.parameters.map((p) => [norm(p.name), p]));
  const addedParams: Parameter[] = [];
  const removedParams: Parameter[] = [];
  const valueChanged: ParamChange[] = [];
  for (const [k, p] of afterParams) {
    const prev = beforeParams.get(k);
    if (!prev) addedParams.push(p);
    else if (prev.value !== p.value) {
      valueChanged.push({ name: p.name, before: prev.value, after: p.value });
    }
  }
  for (const [k, p] of beforeParams) if (!afterParams.has(k)) removedParams.push(p);

  // Filters, compared per worksheet so a filter added to one sheet shows up.
  const beforeFilters = flattenFilters(before.filters);
  const afterFilters = flattenFilters(after.filters);
  const addedFilters: FilterChange[] = [];
  const removedFilters: FilterChange[] = [];
  const changedFilters: FilterChange[] = [];
  for (const [k, f] of afterFilters) {
    const prev = beforeFilters.get(k);
    if (!prev) addedFilters.push(f);
    else if (prev.after !== f.after) {
      changedFilters.push({ ...f, before: prev.after, after: f.after });
    }
  }
  for (const [k, f] of beforeFilters) {
    if (!afterFilters.has(k)) removedFilters.push({ ...f, before: f.after, after: null });
  }

  // Worksheets.
  const beforeSheets = new Set((before.result.worksheets ?? []).map((w) => w.name));
  const afterSheets = new Set((after.result.worksheets ?? []).map((w) => w.name));
  const addedSheets = [...afterSheets].filter((n) => !beforeSheets.has(n)).sort();
  const removedSheets = [...beforeSheets].filter((n) => !afterSheets.has(n)).sort();

  // Dashboards, including which sheets moved on or off them.
  const beforeDash = new Map((before.dashboards?.dashboards ?? []).map((d) => [d.name, d]));
  const afterDash = new Map((after.dashboards?.dashboards ?? []).map((d) => [d.name, d]));
  const addedDash: string[] = [];
  const removedDash: string[] = [];
  const changedDash: DashboardChange[] = [];
  for (const [name, d] of afterDash) {
    const prev = beforeDash.get(name);
    if (!prev) {
      addedDash.push(name);
      continue;
    }
    const add = d.worksheets.filter((w) => !prev.worksheets.includes(w));
    const rem = prev.worksheets.filter((w) => !d.worksheets.includes(w));
    if (add.length || rem.length) {
      changedDash.push({ name, addedSheets: add, removedSheets: rem });
    }
  }
  for (const name of beforeDash.keys()) if (!afterDash.has(name)) removedDash.push(name);

  // Data sources: appearance, disappearance, and extract/live or endpoint moves.
  const beforeDs = new Map((before.provenance?.datasources ?? []).map((d) => [d.name, d]));
  const afterDs = new Map((after.provenance?.datasources ?? []).map((d) => [d.name, d]));
  const addedDs: string[] = [];
  const removedDs: string[] = [];
  const changedDs: DatasourceChange[] = [];
  const connSig = (d: ProvenanceExtractResult['datasources'][number]) =>
    d.connections.map((c) => `${c.class}/${c.dbname ?? ''}@${c.server ?? ''}`).sort().join(', ');
  for (const [name, d] of afterDs) {
    const prev = beforeDs.get(name);
    if (!prev) {
      addedDs.push(name);
      continue;
    }
    if (prev.isExtract !== d.isExtract) {
      changedDs.push({
        name,
        detail: `${prev.isExtract ? 'extract' : 'live'} to ${d.isExtract ? 'extract' : 'live'}`,
      });
    }
    if (connSig(prev) !== connSig(d)) {
      changedDs.push({ name, detail: `connection changed: ${connSig(prev)} to ${connSig(d)}` });
    }
  }
  for (const name of beforeDs.keys()) if (!afterDs.has(name)) removedDs.push(name);

  // Stored SQL.
  const beforeSql = sqlStatements(before.sql);
  const afterSql = sqlStatements(after.sql);
  const addedSql: string[] = [];
  const removedSql: string[] = [];
  const changedSql: string[] = [];
  for (const [k, v] of afterSql) {
    if (!beforeSql.has(k)) addedSql.push(k);
    else if (beforeSql.get(k)!.trim() !== v.trim()) changedSql.push(k);
  }
  for (const k of beforeSql.keys()) if (!afterSql.has(k)) removedSql.push(k);

  const totalChanges =
    addedCalcs.length +
    removedCalcs.length +
    modified.length +
    renamed.length +
    addedParams.length +
    removedParams.length +
    valueChanged.length +
    addedFilters.length +
    removedFilters.length +
    changedFilters.length +
    addedSheets.length +
    removedSheets.length +
    addedDash.length +
    removedDash.length +
    changedDash.length +
    addedDs.length +
    removedDs.length +
    changedDs.length +
    addedSql.length +
    removedSql.length +
    changedSql.length;

  // Headline: the lines worth reading first, ordered by blast radius.
  const headline: string[] = [];
  for (const m of [...modified].sort((a, b) => b.impact.length - a.impact.length).slice(0, 5)) {
    headline.push(
      m.impact.length
        ? `${m.name} changed, affecting ${m.impact.length} downstream field${m.impact.length === 1 ? '' : 's'}`
        : `${m.name} changed`,
    );
  }
  for (const r of renamed.slice(0, 3)) headline.push(`${r.beforeName} renamed to ${r.afterName}`);
  for (const f of removedCalcs.slice(0, 3)) headline.push(`${f.field_name} removed`);
  for (const d of changedDs.slice(0, 2)) headline.push(`${d.name}: ${d.detail}`);
  for (const k of changedSql.slice(0, 2)) headline.push(`SQL changed (${k})`);

  return {
    before: before.label,
    after: after.label,
    identical: totalChanges === 0,
    totalChanges,
    calculations: { added: addedCalcs, removed: removedCalcs, modified, renamed },
    parameters: { added: addedParams, removed: removedParams, valueChanged },
    filters: { added: addedFilters, removed: removedFilters, changed: changedFilters },
    worksheets: { added: addedSheets, removed: removedSheets },
    dashboards: { added: addedDash, removed: removedDash, changed: changedDash },
    datasources: { added: addedDs, removed: removedDs, changed: changedDs },
    sql: { added: addedSql, removed: removedSql, changed: changedSql },
    headline,
  };
}
