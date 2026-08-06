// Filter extraction from Tableau workbooks: which fields are filtered, how
// (categorical / quantitative / relative-date), where (worksheets or the data
// source itself), whether the filter is a context filter, and the selected
// values when the workbook stores them.
//
// Filters repeat across worksheets in the XML (one <filter> per sheet that
// shows it), so results are deduplicated by (datasource, field, kind) with the
// worksheet list aggregated.

import { unzipSync } from 'fflate';
import { TableauExtractionError } from './extractor';

export type FilterKind = 'categorical' | 'quantitative' | 'relative-date' | string;

export interface WorkbookFilter {
  /** Human-readable field name (caption when the workbook defines one). */
  field: string;
  datasource: string;
  kind: FilterKind;
  is_context: boolean;
  /** Worksheets the filter appears on; ['(data source filter)'] when defined on the datasource. */
  worksheets: string[];
  /** Selected members for categorical filters, when stored (capped). */
  members: string[];
  /** e.g. 'in-range' for quantitative filters, plus min/max when stored. */
  range: { included_values: string | null; min: string | null; max: string | null } | null;
}

export interface FilterExtractResult {
  filters: WorkbookFilter[];
  /** Distinct field names used by any filter — “what variables drive the filtering”. */
  fields_used: string[];
  count: number;
  fileLabel: string;
}

// Capture up to 500 selected members so the UI can offer a full "show all"
// view; the interface truncates the DISPLAY (first 5 when a filter has >10),
// not the data.
const MAX_MEMBERS = 500;

/** `none:age:qk` → `age`; plain tokens pass through. */
function unwrapFieldToken(token: string): string {
  const first = token.indexOf(':');
  const last = token.lastIndexOf(':');
  if (first > 0 && last > first) return token.slice(first + 1, last);
  return token;
}

function stripBrackets(s: string): string {
  return s.replace(/^\[|\]$/g, '');
}

/** `"West"` / `%null%` → `West` / `%null%`. */
function cleanMember(v: string): string {
  return v.replace(/^"|"$/g, '');
}

interface DsInfo {
  label: string;
  /** bracketed internal column name -> caption */
  captions: Map<string, string>;
}

function isInsideTag(el: Element, stopAt: Element | null, tag: string): boolean {
  for (let p = el.parentNode as Element | null; p && p !== stopAt; p = p.parentNode as Element | null) {
    if (p.nodeType === 1 && p.tagName?.toLowerCase() === tag) return true;
  }
  return false;
}

function buildDatasourceInfo(root: Element): Map<string, DsInfo> {
  const out = new Map<string, DsInfo>();
  const all = root.getElementsByTagName('datasource');
  for (let i = 0; i < all.length; i++) {
    const ds = all[i];
    const parent = ds.parentNode as Element | null;
    if (!parent || parent.nodeName !== 'datasources') continue;
    const internal = ds.getAttribute('name') || '';
    if (!internal) continue;
    const label = ds.getAttribute('caption') || internal;
    const captions = new Map<string, string>();
    const cols = ds.getElementsByTagName('column');
    for (let j = 0; j < cols.length; j++) {
      const col = cols[j];
      // Skip columns of a datasource nested inside this one (same guard as the
      // lineage extractor's ownColumns).
      if (isInsideTag(col, ds, 'datasource')) continue;
      const name = col.getAttribute('name');
      const caption = col.getAttribute('caption');
      if (name && caption) captions.set(name, caption);
    }
    out.set(internal, { label, captions });
  }
  return out;
}

/** Nearest enclosing worksheet name, or the data-source marker, or null (skip). */
function filterLocation(el: Element): string | null {
  for (let p = el.parentNode as Element | null; p; p = p.parentNode as Element | null) {
    if (p.nodeType !== 1) continue;
    const tag = p.tagName?.toLowerCase();
    if (tag === 'worksheet') return p.getAttribute('name') || 'Unnamed worksheet';
    if (tag === 'dashboard') return p.getAttribute('name') || 'Dashboard';
    if (tag === 'datasource') return '(data source filter)';
  }
  return null;
}

function parseRoot(xmlString: string): Element {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new TableauExtractionError('Could not parse the workbook XML (.twb).');
  }
  const root = doc.documentElement;
  if (!root) throw new TableauExtractionError('Empty or invalid workbook XML.');
  return root;
}

export function extractFiltersFromXml(
  xmlString: string,
  fileLabel = 'Tableau Workbook',
): FilterExtractResult {
  return extractFiltersFromRoot(parseRoot(xmlString), fileLabel);
}

function extractFiltersFromRoot(root: Element, fileLabel: string): FilterExtractResult {
  const dsInfo = buildDatasourceInfo(root);
  const merged = new Map<string, WorkbookFilter>();

  const filters = root.getElementsByTagName('filter');
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    const column = f.getAttribute('column') || '';
    if (!column) continue;
    const where = filterLocation(f);
    if (where === null) continue;

    // `[federated.abc].[none:age:qk]` or a bare `[field]` on data-source filters.
    let dsinternal = '';
    let fieldToken = column;
    const m = column.match(/^\[([^\]]+)\]\.\[([^\]]+)\]$/);
    if (m) {
      dsinternal = m[1];
      fieldToken = m[2];
    } else {
      fieldToken = stripBrackets(column);
    }
    const info = m ? dsInfo.get(m[1]) : null;
    const internalField = `[${unwrapFieldToken(stripBrackets(fieldToken))}]`;
    const field = info?.captions.get(internalField) ?? stripBrackets(internalField);
    const kind = (f.getAttribute('class') || 'unknown') as FilterKind;
    const isContext = f.getAttribute('context') === 'true';

    const key = `${info?.label ?? dsinternal}${field.toLowerCase()}${kind}`;
    let entry = merged.get(key);
    if (!entry) {
      entry = {
        field,
        datasource: info?.label ?? (dsinternal || fileLabel),
        kind,
        is_context: false,
        worksheets: [],
        members: [],
        range: null,
      };
      merged.set(key, entry);
    }
    if (isContext) entry.is_context = true;
    if (!entry.worksheets.includes(where)) entry.worksheets.push(where);

    // Categorical: collect explicitly selected members from nested groupfilters.
    const gfs = f.getElementsByTagName('groupfilter');
    for (let g = 0; g < gfs.length; g++) {
      const member = gfs[g].getAttribute('member');
      if (member && entry.members.length < MAX_MEMBERS) {
        const clean = cleanMember(member);
        if (!entry.members.includes(clean)) entry.members.push(clean);
      }
    }

    // Quantitative: range info when stored.
    const included = f.getAttribute('included-values');
    const minEl = f.getElementsByTagName('min')[0];
    const maxEl = f.getElementsByTagName('max')[0];
    if (included || minEl || maxEl) {
      entry.range = {
        included_values: included || entry.range?.included_values || null,
        min: minEl?.textContent?.trim() || entry.range?.min || null,
        max: maxEl?.textContent?.trim() || entry.range?.max || null,
      };
    }
  }

  const filtersOut = [...merged.values()].sort(
    (a, b) => a.datasource.localeCompare(b.datasource) || a.field.localeCompare(b.field),
  );
  const fieldsUsed = [...new Set(filtersOut.map((x) => x.field))].sort();
  return { filters: filtersOut, fields_used: fieldsUsed, count: filtersOut.length, fileLabel };
}

// ── Worksheet usage ────────────────────────────────────────────────────────────

export interface WorksheetUsage {
  name: string;
  /** Caption-resolved fields the worksheet uses (from datasource-dependencies). */
  fields: string[];
  /** Filters this worksheet applies. */
  filters: { field: string; kind: string; is_context: boolean }[];
}

export function extractWorksheetsFromXml(
  xmlString: string,
  fileLabel = 'Tableau Workbook',
): WorksheetUsage[] {
  const root = parseRoot(xmlString);
  const dsInfo = buildDatasourceInfo(root);
  const filterResult = extractFiltersFromRoot(root, fileLabel);

  const out: WorksheetUsage[] = [];
  const worksheets = root.getElementsByTagName('worksheet');
  for (let i = 0; i < worksheets.length; i++) {
    const ws = worksheets[i];
    const name = ws.getAttribute('name') || `Worksheet ${i + 1}`;
    const fields = new Set<string>();

    const depBlocks = ws.getElementsByTagName('datasource-dependencies');
    for (let d = 0; d < depBlocks.length; d++) {
      const block = depBlocks[d];
      const captions = dsInfo.get(block.getAttribute('datasource') || '')?.captions;
      const resolve = (internal: string | null) => {
        if (!internal) return;
        const clean = `[${unwrapFieldToken(stripBrackets(internal))}]`;
        fields.add(captions?.get(clean) ?? stripBrackets(clean));
      };
      const cols = block.getElementsByTagName('column');
      for (let c = 0; c < cols.length; c++) {
        resolve(cols[c].getAttribute('caption') ? `[${cols[c].getAttribute('caption')}]` : cols[c].getAttribute('name'));
      }
      const instances = block.getElementsByTagName('column-instance');
      for (let c = 0; c < instances.length; c++) resolve(instances[c].getAttribute('column'));
    }

    const filters = filterResult.filters
      .filter((f) => f.worksheets.includes(name))
      .map((f) => ({ field: f.field, kind: f.kind, is_context: f.is_context }));

    out.push({ name, fields: [...fields].sort(), filters });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function extractWorksheetsFromTwbx(
  buffer: ArrayBuffer,
  filename = 'workbook.twbx',
): WorksheetUsage[] {
  return extractWorksheetsFromXml(
    readTwbXml(buffer),
    filename.replace(/\.twbx$/i, ''),
  );
}

function readTwbXml(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (file) => file.name.toLowerCase().endsWith('.twb') });
  } catch {
    throw new TableauExtractionError('This file is not a valid .twbx archive.');
  }
  const twbName = Object.keys(entries)[0];
  if (!twbName) throw new TableauExtractionError('No .twb workbook was found inside the .twbx archive.');
  const twbBytes = entries[twbName];
  if (twbBytes.length > MAX_TWB_BYTES) {
    throw new TableauExtractionError('This workbook is unusually large to parse. Try a smaller .twbx.');
  }
  return new TextDecoder('utf-8').decode(twbBytes);
}

const MAX_TWB_BYTES = 250 * 1024 * 1024;

export function extractFiltersFromTwbx(
  buffer: ArrayBuffer,
  filename = 'workbook.twbx',
): FilterExtractResult {
  const bytes = new Uint8Array(buffer);
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (file) => file.name.toLowerCase().endsWith('.twb') });
  } catch {
    throw new TableauExtractionError('This file is not a valid .twbx archive.');
  }
  const twbName = Object.keys(entries)[0];
  if (!twbName) throw new TableauExtractionError('No .twb workbook was found inside the .twbx archive.');
  const twbBytes = entries[twbName];
  if (twbBytes.length > MAX_TWB_BYTES) {
    throw new TableauExtractionError('This workbook is unusually large to parse. Try a smaller .twbx.');
  }
  const xml = new TextDecoder('utf-8').decode(twbBytes);
  return extractFiltersFromXml(xml, filename.replace(/\.twbx$/i, ''));
}
