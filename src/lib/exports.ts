// Client-side downloads. Everything is generated in-browser from the already-
// parsed result — no network, consistent with the privacy promise.

import type { ExtractResult } from './types';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(label: string): string {
  return (label || 'tableau-workbook').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'workbook';
}

/**
 * The headline export: the watermarked, self-contained interactive HTML report.
 * Reuses the HTML already built by the parse step (no rebuild, no extra bundle).
 */
export function downloadReportHtml(reportHtml: string, fileLabel: string): void {
  triggerDownload(new Blob([reportHtml], { type: 'text/html;charset=utf-8' }), `${safeName(fileLabel)}-lineage.html`);
}

export function downloadJson(result: ExtractResult): void {
  const payload = {
    workbook: result.fileLabel,
    generated_with: 'https://www.tableau-lineage.com',
    stats: result.stats,
    parameters: result.parameters,
    raw_fields: result.rawFields,
    calculated_fields: result.fields,
  };
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${safeName(result.fileLabel)}-lineage.json`,
  );
}

export function downloadCsv(result: ExtractResult): void {
  const esc = (v: string) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const headers = ['Data Source', 'Field Name', 'Type', 'Formula', 'Field Dependencies', 'Parameter Dependencies'];
  const rows = result.fields.map((f) =>
    [
      esc(f.datasource),
      esc(f.field_name),
      esc(f.field_type),
      esc(f.formula),
      esc(f.ingredients.join(', ')),
      esc(f.parameter_dependencies.join(', ')),
    ].join(','),
  );
  const csv = '﻿' + [headers.join(','), ...rows].join('\r\n'); // BOM for Excel
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeName(result.fileLabel)}-lineage.csv`);
}
