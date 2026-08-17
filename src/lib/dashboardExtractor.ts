// Dashboards and data provenance.
//
// Dashboards matter for impact analysis: without them, "what breaks if I change
// this field?" stops at the worksheet, which is not the thing anyone actually
// ships. Provenance answers the other recurring question: is this dashboard
// live or an extract, and how stale is it?
//
// Everything here degrades gracefully. Refresh history in particular is not
// present in every workbook (none of the sample workbooks carry it), so the
// extractor reports what it finds and the UI simply omits what is absent
// rather than implying a workbook is fresh when the file does not say so.

import { TableauExtractionError, readTwbXml, isTopLevelDatasource } from './extractor';

export interface DashboardInfo {
  name: string;
  /** Worksheets placed on this dashboard, in zone order. */
  worksheets: string[];
  hidden: boolean;
  /** Fixed size in px when the dashboard declares one. */
  size: { width: number; height: number } | null;
  /** 'fixed' sizing is faster than 'range'/'automatic'; used by the lint. */
  sizing: string | null;
  /** Phone/tablet layouts declared for this dashboard. */
  deviceLayouts: string[];
}

export interface DashboardExtractResult {
  dashboards: DashboardInfo[];
  /** Worksheets that exist but sit on no dashboard. */
  orphanWorksheets: string[];
  /** Worksheets explicitly hidden in the workbook. */
  hiddenWorksheets: string[];
  fileLabel: string;
}

export interface ConnectionInfo {
  class: string;
  server: string | null;
  dbname: string | null;
  username: string | null;
  /** Published data sources connect through Tableau Server rather than a database. */
  published: boolean;
}

export interface DatasourceProvenance {
  name: string;
  /** True when the workbook carries an extract rather than querying live. */
  isExtract: boolean;
  connections: ConnectionInfo[];
  /** Last extract refresh, when the workbook records one. */
  lastRefresh: string | null;
  refreshType: string | null;
  /** Rows added by the last incremental refresh, when recorded. */
  rowsInserted: string | null;
  incrementalColumn: string | null;
  hasExtractFilters: boolean;
}

export interface ProvenanceExtractResult {
  datasources: DatasourceProvenance[];
  fileLabel: string;
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

function attrNum(el: Element, name: string): number | null {
  const v = el.getAttribute(name);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Dashboards ────────────────────────────────────────────────────────────────

export function extractDashboardsFromXml(
  xmlString: string,
  fileLabel = 'Tableau Workbook',
): DashboardExtractResult {
  const root = parseRoot(xmlString);

  // Worksheet names are needed to tell a worksheet zone from a layout container:
  // both are <zone>, only the former names a real sheet.
  const worksheetNames = new Set<string>();
  const wsEls = root.getElementsByTagName('worksheet');
  for (let i = 0; i < wsEls.length; i++) {
    // Skip <worksheet> references nested inside dashboards.
    const parent = wsEls[i].parentNode as Element | null;
    if (parent && parent.nodeName === 'worksheets') {
      const n = wsEls[i].getAttribute('name');
      if (n) worksheetNames.add(n);
    }
  }

  // Hidden sheets are recorded on the <window> elements, not the worksheet.
  const hiddenWorksheets: string[] = [];
  const windows = root.getElementsByTagName('window');
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    if (w.getAttribute('hidden') === 'true') {
      const n = w.getAttribute('name');
      if (n && worksheetNames.has(n) && !hiddenWorksheets.includes(n)) hiddenWorksheets.push(n);
    }
  }

  const dashboards: DashboardInfo[] = [];
  const placed = new Set<string>();
  const dashEls = root.getElementsByTagName('dashboard');

  for (let i = 0; i < dashEls.length; i++) {
    const d = dashEls[i];
    const parent = d.parentNode as Element | null;
    if (!parent || parent.nodeName !== 'dashboards') continue; // skip device-layout copies
    const name = d.getAttribute('name') || `Dashboard ${i + 1}`;

    const sheets: string[] = [];
    const zones = d.getElementsByTagName('zone');
    for (let z = 0; z < zones.length; z++) {
      const zn = zones[z].getAttribute('name');
      if (zn && worksheetNames.has(zn) && !sheets.includes(zn)) {
        sheets.push(zn);
        placed.add(zn);
      }
    }

    // <size> carries the fixed canvas; sizing mode lives on maxheight/minheight.
    const sizeEl = d.getElementsByTagName('size')[0] ?? null;
    const w = sizeEl ? attrNum(sizeEl, 'maxwidth') ?? attrNum(sizeEl, 'width') : null;
    const h = sizeEl ? attrNum(sizeEl, 'maxheight') ?? attrNum(sizeEl, 'height') : null;

    const deviceLayouts: string[] = [];
    const layouts = d.getElementsByTagName('device-layout');
    for (let l = 0; l < layouts.length; l++) {
      const mode = layouts[l].getAttribute('device-type') || layouts[l].getAttribute('name');
      if (mode && !deviceLayouts.includes(mode)) deviceLayouts.push(mode);
    }

    dashboards.push({
      name,
      worksheets: sheets,
      hidden: hiddenWorksheets.includes(name),
      size: w != null && h != null ? { width: w, height: h } : null,
      sizing: sizeEl?.getAttribute('sizing-mode') ?? null,
      deviceLayouts,
    });
  }

  const orphanWorksheets = [...worksheetNames].filter((n) => !placed.has(n)).sort();

  return {
    dashboards: dashboards.sort((a, b) => a.name.localeCompare(b.name)),
    orphanWorksheets,
    hiddenWorksheets: hiddenWorksheets.sort(),
    fileLabel,
  };
}

export function extractDashboardsFromTwbx(
  buffer: ArrayBuffer,
  filename = 'workbook.twbx',
): DashboardExtractResult {
  return extractDashboardsFromXml(readTwbXml(buffer), filename.replace(/\.twbx?$/i, ''));
}

// ── Provenance ────────────────────────────────────────────────────────────────

/** Connection classes that mean "this workbook carries its own extracted data". */
const EXTRACT_CLASSES = new Set(['hyper', 'dataengine', 'tde', 'excel-direct', 'textscan']);

export function extractProvenanceFromXml(
  xmlString: string,
  fileLabel = 'Tableau Workbook',
): ProvenanceExtractResult {
  const root = parseRoot(xmlString);
  const out: DatasourceProvenance[] = [];

  const datasources = root.getElementsByTagName('datasource');
  for (let i = 0; i < datasources.length; i++) {
    const ds = datasources[i];
    if (!isTopLevelDatasource(ds, root)) continue;
    const label = ds.getAttribute('caption') || ds.getAttribute('name') || 'Unknown';
    if (label.toLowerCase() === 'parameters') continue;

    const connections: ConnectionInfo[] = [];
    const seen = new Set<string>();
    const connEls = ds.getElementsByTagName('connection');
    for (let c = 0; c < connEls.length; c++) {
      const cls = connEls[c].getAttribute('class') || '';
      // 'federated' is a wrapper around the real connections beneath it.
      if (!cls || cls === 'federated') continue;
      const server = connEls[c].getAttribute('server') || null;
      const dbname = connEls[c].getAttribute('dbname') || null;
      const key = `${cls}|${server}|${dbname}`;
      if (seen.has(key)) continue;
      seen.add(key);
      connections.push({
        class: cls,
        server,
        dbname,
        username: connEls[c].getAttribute('username') || null,
        published: cls === 'sqlproxy',
      });
    }

    const isExtract =
      ds.getElementsByTagName('extract').length > 0 ||
      connections.some((c) => EXTRACT_CLASSES.has(c.class));

    // Refresh history is optional: many workbooks carry none at all. Read it if
    // present, report null otherwise, and never infer freshness from silence.
    let lastRefresh: string | null = null;
    let refreshType: string | null = null;
    let rowsInserted: string | null = null;
    let incrementalColumn: string | null = null;

    const refreshEvents = ds.getElementsByTagName('refresh-event');
    if (refreshEvents.length > 0) {
      const latest = refreshEvents[refreshEvents.length - 1];
      lastRefresh = latest.getAttribute('time') || null;
      refreshType = latest.getAttribute('refresh-type') || null;
      rowsInserted = latest.getAttribute('rows-inserted') || null;
      incrementalColumn = latest.getAttribute('increment-key') || null;
    }
    const refreshEl = ds.getElementsByTagName('refresh')[0];
    if (refreshEl) {
      incrementalColumn = incrementalColumn ?? refreshEl.getAttribute('increment-key');
    }

    const hasExtractFilters =
      ds.getElementsByTagName('extract').length > 0 &&
      ds.getElementsByTagName('extract')[0].getElementsByTagName('filter').length > 0;

    out.push({
      name: label,
      isExtract,
      connections,
      lastRefresh,
      refreshType,
      rowsInserted,
      incrementalColumn,
      hasExtractFilters,
    });
  }

  return { datasources: out.sort((a, b) => a.name.localeCompare(b.name)), fileLabel };
}

export function extractProvenanceFromTwbx(
  buffer: ArrayBuffer,
  filename = 'workbook.twbx',
): ProvenanceExtractResult {
  return extractProvenanceFromXml(readTwbXml(buffer), filename.replace(/\.twbx?$/i, ''));
}
