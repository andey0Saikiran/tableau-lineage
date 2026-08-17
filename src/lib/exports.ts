// Client-side downloads. Everything is generated in-browser from the already-
// parsed result — no network, consistent with the privacy promise.

import type { ExtractResult } from './types';
import type { AuditResult } from './audit';
import type { FilterExtractResult } from './filterExtractor';
import type { SqlExtractResult } from './sqlExtractor';
import type { DashboardExtractResult, ProvenanceExtractResult } from './dashboardExtractor';

/** Everything one analysis produced, so exports can carry all of it. */
export interface AnalysisBundle {
  result: ExtractResult;
  audit?: AuditResult | null;
  filters?: FilterExtractResult | null;
  sql?: SqlExtractResult | null;
  dashboards?: DashboardExtractResult | null;
  provenance?: ProvenanceExtractResult | null;
}

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

/**
 * The complete model. Previously this carried only fields and parameters, so
 * the audit, filters, SQL and dashboards were visible on screen but could not
 * leave the session.
 */
export function downloadJson(bundle: AnalysisBundle): void {
  const { result, audit, filters, sql, dashboards, provenance } = bundle;
  const payload = {
    workbook: result.fileLabel,
    generated_with: 'https://tableau-lineage.com',
    generated_by: 'Sai Kiran Andey',
    stats: result.stats,
    audit: audit
      ? {
          dead_weight_pct: audit.dead_weight_pct,
          unused: audit.dead,
          unused_by_confidence: audit.dead_by_confidence,
          duplicates: audit.duplicates,
          performance: audit.lint,
          performance_by_severity: audit.lint_by_severity,
          limited: audit.limited,
          limitations: audit.limitations,
        }
      : null,
    parameters: result.parameters,
    raw_fields: result.rawFields,
    calculated_fields: result.fields,
    worksheets: result.worksheets ?? [],
    dashboards: dashboards?.dashboards ?? [],
    orphan_worksheets: dashboards?.orphanWorksheets ?? [],
    hidden_worksheets: dashboards?.hiddenWorksheets ?? [],
    filters: filters?.filters ?? [],
    data_sources: provenance?.datasources ?? [],
    sql: sql?.has_sql
      ? {
          custom_sql: sql.custom_sql,
          initial_sql: sql.initial_sql,
          stored_procedures: sql.stored_procedures,
          rawsql_calculations: sql.rawsql_calculations,
        }
      : null,
  };
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${safeName(result.fileLabel)}-lineage.json`,
  );
}

export function downloadCsv(result: ExtractResult): void {
  const esc = (v: string) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const fieldSheets = new Map<string, string[]>();
  for (const ws of result.worksheets ?? []) {
    for (const f of ws.fields) {
      const list = fieldSheets.get(f) ?? [];
      list.push(ws.name);
      fieldSheets.set(f, list);
    }
  }
  const headers = ['Data Source', 'Field Name', 'Type', 'Formula', 'Field Dependencies', 'Parameter Dependencies', 'Used In Worksheets'];
  const rows = result.fields.map((f) =>
    [
      esc(f.datasource),
      esc(f.field_name),
      esc(f.field_type),
      esc(f.formula),
      esc(f.ingredients.join(', ')),
      esc(f.parameter_dependencies.join(', ')),
      esc((fieldSheets.get(f.field_name) ?? []).join(', ')),
    ].join(','),
  );
  const csv = '﻿' + [headers.join(','), ...rows].join('\r\n'); // BOM for Excel
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeName(result.fileLabel)}-lineage.csv`);
}

// ── Markdown handover pack ────────────────────────────────────────────────────

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|');
}

/**
 * A written handover document: what the workbook contains, what is wrong with
 * it, and where every number comes from. Markdown because it pastes into a
 * README, a ticket, a wiki or a Confluence page, and because it is the format
 * an LLM reads best when someone asks it about the workbook later.
 */
export function buildMarkdown(bundle: AnalysisBundle): string {
  const { result, audit, filters, sql, dashboards, provenance } = bundle;
  const L: string[] = [];
  const s = result.stats;

  L.push(`# ${result.fileLabel}`);
  L.push('');
  L.push(
    `Workbook documentation generated by [tableau-lineage.com](https://tableau-lineage.com), ` +
      `built by [Sai Kiran Andey](https://www.linkedin.com/in/andeysaikiran/). ` +
      `Parsed locally; the workbook was never uploaded.`,
  );
  L.push('');

  L.push('## At a glance');
  L.push('');
  L.push('| Metric | Count |');
  L.push('| --- | ---: |');
  L.push(`| Data sources | ${s.datasources} |`);
  L.push(`| Calculated fields | ${s.calculated_fields} |`);
  L.push(`| Raw fields | ${s.raw_fields} |`);
  L.push(`| Parameters | ${s.parameters} |`);
  L.push(`| LOD calcs | ${s.lod_fields} |`);
  L.push(`| Table calcs | ${s.table_calcs} |`);
  if (dashboards) L.push(`| Dashboards | ${dashboards.dashboards.length} |`);
  if (result.worksheets) L.push(`| Worksheets | ${result.worksheets.length} |`);
  if (filters) L.push(`| Filters | ${filters.count} |`);
  L.push('');

  if (audit) {
    L.push('## Audit');
    L.push('');
    L.push(
      `${audit.dead.length} unused field${audit.dead.length === 1 ? '' : 's'} ` +
        `(${audit.dead_weight_pct}% of the workbook), ${audit.duplicates.length} duplicate group` +
        `${audit.duplicates.length === 1 ? '' : 's'}, ${audit.lint.length} performance finding` +
        `${audit.lint.length === 1 ? '' : 's'}.`,
    );
    L.push('');
    if (audit.limited) {
      L.push(`> Note: ${audit.limitations.join(' ')}`);
      L.push('');
    }
    if (audit.dead.length) {
      L.push(`### Unused (${audit.dead.length})`);
      L.push('');
      L.push('| Field | Kind | Confidence | Why |');
      L.push('| --- | --- | --- | --- |');
      for (const d of audit.dead.slice(0, 60)) {
        L.push(`| ${mdEscape(d.name)} | ${d.kind} | ${d.confidence} | ${mdEscape(d.reason)} |`);
      }
      if (audit.dead.length > 60) L.push(`| … | | | ${audit.dead.length - 60} more |`);
      L.push('');
    }
    if (audit.duplicates.length) {
      L.push(`### Duplicate calculations (${audit.duplicates.length})`);
      L.push('');
      for (const g of audit.duplicates) {
        L.push(`- **${g.kind === 'identical-formula' ? 'Identical formula' : 'Same name, different formula'}**: ${g.members.map((m) => mdEscape(m.name)).join(', ')}`);
      }
      L.push('');
    }
    if (audit.lint.length) {
      L.push(`### Performance findings (${audit.lint.length})`);
      L.push('');
      for (const f of audit.lint) {
        L.push(`- **[${f.severity}] ${mdEscape(f.title)}** (${mdEscape(f.subject)}): ${mdEscape(f.detail)}`);
        if (f.fix) L.push(`  - Fix: ${mdEscape(f.fix)}`);
      }
      L.push('');
    }
  }

  if (dashboards?.dashboards.length) {
    L.push('## Dashboards');
    L.push('');
    for (const d of dashboards.dashboards) {
      L.push(`### ${d.name}`);
      L.push('');
      if (d.size) L.push(`Fixed size ${d.size.width}x${d.size.height}.`);
      L.push(`Worksheets: ${d.worksheets.map(mdEscape).join(', ') || 'none'}`);
      L.push('');
    }
    if (dashboards.orphanWorksheets.length) {
      L.push(`Worksheets on no dashboard: ${dashboards.orphanWorksheets.map(mdEscape).join(', ')}`);
      L.push('');
    }
  }

  if (provenance?.datasources.length) {
    L.push('## Data sources');
    L.push('');
    for (const ds of provenance.datasources) {
      const conns = ds.connections
        .map((c) => [c.class, c.dbname, c.server].filter(Boolean).join(' / '))
        .join('; ');
      L.push(`- **${mdEscape(ds.name)}** (${ds.isExtract ? 'extract' : 'live'})${conns ? `: ${mdEscape(conns)}` : ''}${ds.lastRefresh ? `, last refresh ${ds.lastRefresh}` : ''}`);
    }
    L.push('');
  }

  if (result.parameters.length) {
    L.push('## Parameters');
    L.push('');
    L.push('| Parameter | Type | Current value |');
    L.push('| --- | --- | --- |');
    for (const p of result.parameters) {
      L.push(`| ${mdEscape(p.name)} | ${p.datatype} | ${mdEscape(p.value)} |`);
    }
    L.push('');
  }

  if (filters?.filters.length) {
    L.push('## Filters');
    L.push('');
    L.push('| Field | Kind | Context | Where | Selection |');
    L.push('| --- | --- | --- | --- | --- |');
    for (const f of filters.filters) {
      const sel = f.members.length
        ? f.members.slice(0, 8).join(', ') + (f.members.length > 8 ? ` +${f.members.length - 8}` : '')
        : f.range?.min || f.range?.max
          ? `${f.range?.min ?? '…'} to ${f.range?.max ?? '…'}`
          : '';
      L.push(
        `| ${mdEscape(f.field)} | ${f.kind} | ${f.is_context ? 'yes' : ''} | ${mdEscape(f.worksheets.slice(0, 4).join(', '))}${f.worksheets.length > 4 ? ` +${f.worksheets.length - 4}` : ''} | ${mdEscape(sel)} |`,
      );
    }
    L.push('');
  }

  L.push('## Calculated fields');
  L.push('');
  const byDs = new Map<string, typeof result.fields>();
  for (const f of result.fields) {
    if (!byDs.has(f.datasource)) byDs.set(f.datasource, []);
    byDs.get(f.datasource)!.push(f);
  }
  const sheetsOf = new Map<string, string[]>();
  for (const ws of result.worksheets ?? []) {
    for (const f of ws.fields) {
      const list = sheetsOf.get(f) ?? [];
      list.push(ws.name);
      sheetsOf.set(f, list);
    }
  }
  for (const [ds, fields] of byDs) {
    L.push(`### ${mdEscape(ds)}`);
    L.push('');
    for (const f of fields) {
      L.push(`#### ${mdEscape(f.field_name)}`);
      L.push('');
      L.push('```');
      L.push(f.formula);
      L.push('```');
      L.push('');
      const deps = [...f.ingredients, ...f.parameter_dependencies];
      if (deps.length) L.push(`- Depends on: ${deps.map(mdEscape).join(', ')}`);
      const used = sheetsOf.get(f.field_name);
      if (used?.length) L.push(`- Used on: ${used.map(mdEscape).join(', ')}`);
      if (f.lod_type) L.push(`- LOD: ${f.lod_type}`);
      if (f.is_table_calc) L.push('- Table calculation');
      L.push('');
    }
  }

  if (sql?.has_sql) {
    L.push('## Stored SQL');
    L.push('');
    for (const q of sql.custom_sql) {
      L.push(`### Custom SQL: ${mdEscape(q.relation_name)} (${mdEscape(q.datasource)})`);
      L.push('');
      L.push('```sql');
      L.push(q.sql);
      L.push('```');
      L.push('');
    }
    for (const q of sql.initial_sql) {
      L.push(`### Initial SQL (${mdEscape(q.datasource)})`);
      L.push('');
      L.push('```sql');
      L.push(q.sql);
      L.push('```');
      L.push('');
    }
    for (const p of sql.stored_procedures) {
      L.push(
        `- Stored procedure \`${mdEscape(p.name)}\` (${mdEscape(p.datasource)})${p.parameters.length ? `: ${p.parameters.map((x) => `${x.name}=${x.value}`).join(', ')}` : ''}`,
      );
    }
    if (sql.stored_procedures.length) L.push('');
    for (const f of sql.rawsql_calculations) {
      L.push(`- RAWSQL field **${mdEscape(f.field_name)}**: \`${mdEscape(f.formula)}\``);
    }
    L.push('');
  }

  return L.join('\n');
}

export function downloadMarkdown(bundle: AnalysisBundle): void {
  triggerDownload(
    new Blob([buildMarkdown(bundle)], { type: 'text/markdown;charset=utf-8' }),
    `${safeName(bundle.result.fileLabel)}-documentation.md`,
  );
}
