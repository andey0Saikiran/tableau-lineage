// Builds the self-contained, watermarked, interactive HTML report — the same
// artifact that is shown in-app (via an <iframe srcdoc>) AND offered as a
// download. vis-network is inlined so the downloaded file works fully offline.
//
// Mirrors the original `html_gen.py`: load a template, replace tokens. Keeping
// the report as a separate raw asset (rather than a JS template literal) avoids
// nested-template escaping and keeps the proven visualization code untouched.

import templateHtml from '../assets/report-template.html?raw';
import visNetworkSource from '../vendor/vis-network.min.js?raw';
import type { ExtractResult } from './types';

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON safe to embed inside a <script> block (no </script> or LS/PS breakouts). */
function jsonForScript(value: unknown): string {
  const LS = String.fromCharCode(0x2028); // line separator
  const PS = String.fromCharCode(0x2029); // paragraph separator
  return JSON.stringify(value)
    .split('<').join('\\u003c')
    .split(LS).join('\\u2028')
    .split(PS).join('\\u2029');
}

export function buildReportHtml(result: ExtractResult): string {
  const fileLabel = result.fileLabel || 'Tableau Workbook';

  // Collision-proof substitution: a SINGLE pass over the original template, where
  // each sentinel resolves to its own payload. Because the scan never re-reads the
  // injected payloads, attacker-controlled workbook text (which lives only inside
  // those payloads) can never be mistaken for a later placeholder. The function
  // replacer also means `$` in the JSON / vis source is treated literally.
  const tokens: Record<string, string> = {
    '/*__VIS_NETWORK__*/': visNetworkSource,
    __FILE_LABEL__: htmlEscape(fileLabel),
    __JSON_DATA__: jsonForScript(result.fields),
    __PARAMS_JSON__: jsonForScript(result.parameters),
    __DS_COUNT__: String(result.stats.datasources),
    __CALC_COUNT__: String(result.stats.calculated_fields),
    __RAW_COUNT__: String(result.stats.raw_fields),
    __PARAM_COUNT__: String(result.stats.parameters),
    __LOD_COUNT__: String(result.stats.lod_fields),
    __TABLECALC_COUNT__: String(result.stats.table_calcs),
  };
  const re =
    /\/\*__VIS_NETWORK__\*\/|__FILE_LABEL__|__JSON_DATA__|__PARAMS_JSON__|__DS_COUNT__|__CALC_COUNT__|__RAW_COUNT__|__PARAM_COUNT__|__LOD_COUNT__|__TABLECALC_COUNT__/g;
  return templateHtml.replace(re, (m) => tokens[m] ?? m);
}
