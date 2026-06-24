// ───────────────────────────────────────────────────────────────────────────
// Tableau workbook metadata extractor — client-side port of the original
// Python `lineage/extractor.py` (TableauExtractor).
//
// Runs ENTIRELY in the browser: a .twbx is just a ZIP whose first .twb entry is
// XML. We unzip with fflate and parse with the native DOMParser, so the file
// never leaves the user's machine.
//
// Faithful to the original four-phase algorithm, with two correctness fixes that
// the original got wrong on real workbooks:
//   FIX 1 — parameter references by caption. The original keyed its parameter
//           map on the internal <name>, so a formula referencing
//           `[Parameters].[<caption>]` (what Tableau actually writes) never
//           resolved and leaked a phantom "Parameters" dependency. We resolve
//           `[Parameters].[X]` for X = caption OR internal name and strip the
//           qualifier, so no phantom node appears.
//   FIX 2 — table-calc / LOD detection by token, not substring. The original
//           used a substring test, so `TOTAL` inside `[total_views]` falsely
//           flagged a field as a table calc. We match whole function calls
//           (`\bTOTAL\s*(`) and brace-anchored LOD keywords instead.
// ───────────────────────────────────────────────────────────────────────────

import { unzipSync, strFromU8 } from 'fflate';
import type {
  CalculatedField,
  ExtractResult,
  FieldType,
  LineageStats,
  LodType,
  Parameter,
} from './types';

export class TableauExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TableauExtractionError';
  }
}

// Table-calculation function names (from the original TABLE_CALC_FUNCTIONS set).
const TABLE_CALC_FUNCTIONS = [
  'LOOKUP', 'RUNNING_SUM', 'RUNNING_AVG', 'RUNNING_MIN', 'RUNNING_MAX',
  'RUNNING_COUNT', 'WINDOW_SUM', 'WINDOW_AVG', 'WINDOW_MIN', 'WINDOW_MAX',
  'WINDOW_COUNT', 'WINDOW_MEDIAN', 'WINDOW_PERCENTILE', 'WINDOW_STDEV',
  'WINDOW_VAR', 'FIRST', 'LAST', 'INDEX', 'SIZE', 'RANK_DENSE',
  'RANK_MODIFIED', 'RANK_PERCENTILE', 'RANK_UNIQUE', 'RANK', 'PREVIOUS_VALUE',
  'TOTAL', 'SCRIPT_BOOL', 'SCRIPT_INT', 'SCRIPT_REAL', 'SCRIPT_STR',
];

// `\b(FUNC|...)\s*\(` — a real function call, not an identifier substring.
// (RANK_* variants are listed before RANK so the regex prefers the longer name.)
const TABLE_CALC_RE = new RegExp(
  '\\b(' + TABLE_CALC_FUNCTIONS.join('|') + ')\\s*\\(',
  'i',
);

// LOD expression: a curly brace immediately followed by FIXED/INCLUDE/EXCLUDE.
const LOD_RE = /\{\s*(FIXED|INCLUDE|EXCLUDE)\b/i;

// Invisible marker stamped onto resolved PARAMETER references (e.g. from
// `[Parameters].[X]`) so they stay distinguishable from a same-named field
// reference. Stripped from the stored formula before output.
const PARAM_TAG = String.fromCharCode(1); // U+0001, cannot appear in a real caption

/** Find the first direct-child element named `tag` (not a descendant search). */
function findChild(el: Element, tag: string): Element | null {
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).tagName.toLowerCase() === tag) {
      return n as Element;
    }
  }
  return null;
}

/**
 * Columns that belong directly to `ds` — NOT those inside a datasource nested
 * within it. `getElementsByTagName` is recursive, so without this a literal
 * <datasource> inside another would double-count its columns.
 */
function ownColumns(ds: Element): Element[] {
  const out: Element[] = [];
  const cols = ds.getElementsByTagName('column');
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    let nested = false;
    for (let p = c.parentNode as Element | null; p && p !== ds; p = p.parentNode as Element | null) {
      if (p.nodeType === 1 && p.tagName.toLowerCase() === 'datasource') {
        nested = true;
        break;
      }
    }
    if (!nested) out.push(c);
  }
  return out;
}

interface ExtractState {
  fieldMap: Map<string, string>; // internal column name -> caption
  parameters: Parameter[];
  parameterNames: Set<string>; // display names
  paramAliasToDisplay: Map<string, string>; // caption|internal|cleanInternal -> display
  rawFields: Set<string>;
  calculatedFields: CalculatedField[];
}

function newState(): ExtractState {
  return {
    fieldMap: new Map(),
    parameters: [],
    parameterNames: new Set(),
    paramAliasToDisplay: new Map(),
    rawFields: new Set(),
    calculatedFields: [],
  };
}

// ── Phase 1: parameters (must run first — replacement & dep-splitting need it) ─
function extractParameters(root: Element, s: ExtractState): void {
  const datasources = root.getElementsByTagName('datasource');
  for (let i = 0; i < datasources.length; i++) {
    const ds = datasources[i];
    const dsName = ds.getAttribute('caption') || ds.getAttribute('name') || '';
    if (dsName.toLowerCase() !== 'parameters') continue;

    const columns = ownColumns(ds);
    for (let j = 0; j < columns.length; j++) {
      const col = columns[j];
      const internalName = col.getAttribute('name') || ''; // e.g. [Parameter 1]
      if (!internalName) continue;
      const caption = col.getAttribute('caption') || '';
      const value = col.getAttribute('value') || '';
      const datatype = col.getAttribute('datatype') || 'string';

      const cleanInternal = internalName.replace(/^[[\]]+|[[\]]+$/g, '');
      const displayName = caption || cleanInternal;

      s.parameterNames.add(displayName);
      // FIX 1: index every alias a formula might reference so [Parameters].[X]
      // resolves whether X is the caption, the bracketed name, or the bare name.
      s.paramAliasToDisplay.set(internalName, displayName);
      s.paramAliasToDisplay.set(cleanInternal, displayName);
      if (caption) s.paramAliasToDisplay.set(caption, displayName);

      const allowedValues = extractParamMembers(col);
      s.parameters.push({
        name: displayName,
        internal_name: internalName,
        value,
        datatype,
        allowed_values: allowedValues,
      });
    }
  }
}

/** Read a list parameter's <members> so the dictionary can show its options. */
function extractParamMembers(col: Element): Parameter['allowed_values'] {
  const membersEl = findChild(col, 'members');
  if (!membersEl) return null;
  const members = membersEl.getElementsByTagName('member');
  const out: { value: string; alias?: string }[] = [];
  for (let i = 0; i < members.length; i++) {
    const v = members[i].getAttribute('value');
    if (v == null) continue;
    const alias = members[i].getAttribute('alias');
    out.push(alias ? { value: v, alias } : { value: v });
  }
  return out.length ? out : null;
}

// ── Phase 2: build the internal-name -> caption map across all columns ────────
function buildFieldMappings(root: Element, s: ExtractState): void {
  const columns = root.getElementsByTagName('column');
  for (let i = 0; i < columns.length; i++) {
    const name = columns[i].getAttribute('name');
    const caption = columns[i].getAttribute('caption');
    if (name && caption) s.fieldMap.set(name, caption);
  }
}

// ── Phase 3: calculated fields (the ones carrying a <calculation> child) ──────
function extractCalculatedFields(root: Element, s: ExtractState): void {
  const datasources = root.getElementsByTagName('datasource');
  for (let i = 0; i < datasources.length; i++) {
    const ds = datasources[i];
    const dsName = ds.getAttribute('caption') || ds.getAttribute('name') || 'Unknown';
    if (dsName.toLowerCase() === 'parameters') continue;

    const columns = ownColumns(ds);
    for (let j = 0; j < columns.length; j++) {
      const col = columns[j];
      const calc = findChild(col, 'calculation');
      if (!calc) continue;

      const rawName = col.getAttribute('name') || '';
      const fieldName = col.getAttribute('caption') || rawName;
      const rawFormula = calc.getAttribute('formula') || '';

      // `tagged` carries PARAM_TAG markers on resolved parameter refs; `formula`
      // is the clean, human-readable version stored on the field.
      const tagged = replaceFieldNames(rawFormula, s);
      const formula = tagged.split(PARAM_TAG).join('');
      const { ingredients, paramDeps } = extractDependencies(tagged);
      const { fieldType, isTableCalc, lodType } = determineFieldType(formula);

      s.calculatedFields.push({
        datasource: dsName,
        field_name: fieldName,
        formula,
        ingredients: [...ingredients].sort(),
        parameter_dependencies: [...paramDeps].sort(),
        field_type: fieldType,
        is_table_calc: isTableCalc,
        lod_type: lodType,
      });
    }
  }
}

function replaceFieldNames(formula: string, s: ExtractState): string {
  // FIX 1: resolve any [Parameters].[X] reference (X may be caption or name),
  // drop the [Parameters]. qualifier, and stamp it as a parameter so it survives
  // as a param dependency (no phantom "Parameters" token).
  formula = formula.replace(
    /\[Parameters\]\.\s*\[([^\]]+)\]/gi,
    (_m, inner: string) => '[' + PARAM_TAG + (s.paramAliasToDisplay.get(inner) ?? inner) + ']',
  );

  // Regular fields: internal name -> caption (untagged → treated as a field).
  // Note: we deliberately do NOT rewrite *bare* parameter references here. Real
  // Tableau always writes params as [Parameters].[X] (handled above); treating a
  // bare [X] as a field avoids hijacking a same-named field reference.
  for (const [internalName, caption] of s.fieldMap) {
    formula = formula.split(internalName).join('[' + caption + ']');
  }

  return formula;
}

function extractDependencies(taggedFormula: string): {
  ingredients: Set<string>;
  paramDeps: Set<string>;
} {
  const ingredients = new Set<string>();
  const paramDeps = new Set<string>();
  const matches = taggedFormula.matchAll(/\[([^\]]+)\]/g);
  for (const m of matches) {
    const token = m[1];
    // FIX 3: classify by ORIGIN (the PARAM_TAG marker), not by name membership —
    // so a field and a parameter that share a name don't collide and drop edges.
    if (token.startsWith(PARAM_TAG)) paramDeps.add(token.slice(PARAM_TAG.length));
    else ingredients.add(token);
  }
  return { ingredients, paramDeps };
}

function determineFieldType(formula: string): {
  fieldType: FieldType;
  isTableCalc: boolean;
  lodType: LodType;
} {
  // FIX 2: token-anchored detection (no substring false positives).
  const isTableCalc = TABLE_CALC_RE.test(formula);
  const lodMatch = formula.match(LOD_RE);
  const lodType = (lodMatch ? lodMatch[1].toUpperCase() : null) as LodType;

  let fieldType: FieldType;
  if (lodType) fieldType = 'lod';
  else if (isTableCalc) fieldType = 'table_calc';
  else fieldType = 'calculated';

  return { fieldType, isTableCalc, lodType };
}

// ── Phase 4: raw fields = referenced names that are neither calc nor param ────
function identifyRawFields(s: ExtractState): void {
  const allReferenced = new Set<string>();
  const calculatedNames = new Set(s.calculatedFields.map((f) => f.field_name));
  for (const f of s.calculatedFields) for (const ing of f.ingredients) allReferenced.add(ing);
  s.rawFields = new Set(
    [...allReferenced].filter((x) => !calculatedNames.has(x) && !s.parameterNames.has(x)),
  );
}

function computeStats(s: ExtractState): LineageStats {
  const datasources = new Set<string>();
  let lod = 0;
  let tableCalcs = 0;
  for (const f of s.calculatedFields) {
    datasources.add(f.datasource);
    if (f.lod_type) lod++;
    if (f.is_table_calc) tableCalcs++;
  }
  return {
    datasources: datasources.size,
    calculated_fields: s.calculatedFields.length,
    raw_fields: s.rawFields.size,
    parameters: s.parameters.length,
    lod_fields: lod,
    table_calcs: tableCalcs,
    total_fields: s.calculatedFields.length + s.rawFields.size,
  };
}

/**
 * Extract lineage from a .twb XML string. Exposed separately so it can be unit
 * tested in Node (with an injected DOMParser) without a real ZIP.
 */
export function extractFromXml(xmlString: string, fileLabel = 'Tableau Workbook'): ExtractResult {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  const parserError = doc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new TableauExtractionError('Could not parse the workbook XML (.twb).');
  }
  const root = doc.documentElement;
  if (!root) throw new TableauExtractionError('Empty or invalid workbook XML.');

  const s = newState();
  extractParameters(root, s);
  buildFieldMappings(root, s);
  extractCalculatedFields(root, s);
  identifyRawFields(s);

  return {
    fields: s.calculatedFields,
    parameters: s.parameters,
    rawFields: [...s.rawFields].sort(),
    stats: computeStats(s),
    fileLabel,
  };
}

const MAX_TWB_BYTES = 80 * 1024 * 1024; // guardrail: DOMParser holds the whole tree in memory

/**
 * Full browser entry point: unzip a .twbx ArrayBuffer, find its .twb, and
 * extract lineage. Nothing is uploaded — this all runs locally.
 */
export function extractFromTwbx(buffer: ArrayBuffer, filename = 'workbook.twbx'): ExtractResult {
  const bytes = new Uint8Array(buffer);
  let entries: Record<string, Uint8Array>;
  try {
    // Only decompress .twb entries — skip the (often large) bundled data extract.
    entries = unzipSync(bytes, { filter: (file) => file.name.toLowerCase().endsWith('.twb') });
  } catch {
    throw new TableauExtractionError('This file is not a valid .twbx archive.');
  }

  const twbName = Object.keys(entries)[0];
  if (!twbName) {
    throw new TableauExtractionError('No .twb workbook was found inside the .twbx archive.');
  }

  const twbBytes = entries[twbName];
  if (twbBytes.length > MAX_TWB_BYTES) {
    throw new TableauExtractionError(
      'This workbook is unusually large to parse in the browser. Try a smaller .twbx.',
    );
  }

  const xml = strFromU8(twbBytes);
  const fileLabel = filename.replace(/\.twbx$/i, '').replace(/\.twb$/i, '');
  const result = extractFromXml(xml, fileLabel);

  if (result.fields.length === 0) {
    throw new TableauExtractionError('No calculated fields were found in this workbook.');
  }
  return result;
}
