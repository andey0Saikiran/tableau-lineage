import { ChevronDown, LayoutDashboard, Database, EyeOff, Server, Snowflake, Radio } from 'lucide-react';
import type { DashboardExtractResult, ProvenanceExtractResult } from '../lib/dashboardExtractor';

interface Props {
  dashboards: DashboardExtractResult | null;
  provenance: ProvenanceExtractResult | null;
}

/**
 * Dashboards (what ships) and provenance (where the data comes from, and
 * whether it is live or extracted). Values the workbook does not record are
 * omitted rather than guessed: a missing refresh time means "not recorded",
 * never "fresh".
 */
export function StructurePanel({ dashboards, provenance }: Props) {
  const hasDashboards = (dashboards?.dashboards.length ?? 0) > 0;
  const hasProvenance = (provenance?.datasources.length ?? 0) > 0;
  if (!hasDashboards && !hasProvenance) return null;

  const dashCount = dashboards?.dashboards.length ?? 0;
  const orphans = dashboards?.orphanWorksheets ?? [];
  const hidden = dashboards?.hiddenWorksheets ?? [];

  return (
    <details className="group rounded-2xl border border-border bg-white/80 shadow-sm backdrop-blur-sm open:border-violet-300">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-brand-500 text-white">
          <LayoutDashboard className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">Dashboards &amp; data sources</span>
          <span className="block truncate text-xs text-muted">
            {dashCount > 0 && `${dashCount} dashboard${dashCount === 1 ? '' : 's'}`}
            {dashCount > 0 && hasProvenance && ' · '}
            {hasProvenance &&
              `${provenance!.datasources.length} data source${provenance!.datasources.length === 1 ? '' : 's'}`}
            {orphans.length > 0 && ` · ${orphans.length} sheet${orphans.length === 1 ? '' : 's'} on no dashboard`}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-violet-500 transition-transform duration-300 group-open:rotate-180" />
      </summary>

      <div className="space-y-5 border-t border-border/70 px-5 pb-5 pt-4">
        {hasDashboards && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Dashboards</h3>
            <div className="mt-2 space-y-2">
              {dashboards!.dashboards.map((d) => (
                <details key={d.name} className="group/d rounded-xl border border-border bg-white px-4 py-2.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                      <span className="truncate">{d.name}</span>
                      <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-muted">
                        {d.worksheets.length} sheet{d.worksheets.length === 1 ? '' : 's'}
                      </span>
                      {d.size && (
                        <span className="flex-shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                          {d.size.width}×{d.size.height}
                        </span>
                      )}
                      {d.deviceLayouts.length > 0 && (
                        <span className="hidden flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-muted sm:inline">
                          {d.deviceLayouts.join(', ')}
                        </span>
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted transition-transform duration-300 group-open/d:rotate-180" />
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.worksheets.map((w) => (
                      <span key={w} className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                        {w}
                      </span>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {(orphans.length > 0 || hidden.length > 0) && (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {orphans.length > 0 && (
              <div className="min-w-[12rem] flex-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted">On no dashboard</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {orphans.map((w) => (
                    <span key={w} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-muted">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {hidden.length > 0 && (
              <div className="min-w-[12rem] flex-1">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                  <EyeOff className="h-3.5 w-3.5" /> Hidden sheets
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {hidden.map((w) => (
                    <span key={w} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-muted">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasProvenance && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <Database className="h-3.5 w-3.5" /> Data sources
            </h3>
            <div className="mt-2 space-y-2">
              {provenance!.datasources.map((ds) => (
                <div key={ds.name} className="rounded-xl border border-border bg-white px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{ds.name}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        ds.isExtract ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {ds.isExtract ? <Snowflake className="h-3 w-3" /> : <Radio className="h-3 w-3" />}
                      {ds.isExtract ? 'Extract' : 'Live'}
                    </span>
                    {ds.connections.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-muted"
                      >
                        <Server className="h-3 w-3" />
                        {[c.class, c.dbname, c.server && `@ ${c.server}`].filter(Boolean).join(' · ')}
                        {c.published && ' (published)'}
                      </span>
                    ))}
                  </div>
                  {(ds.lastRefresh || ds.incrementalColumn || ds.hasExtractFilters) && (
                    <p className="mt-1.5 text-xs text-muted">
                      {ds.lastRefresh && `Last refresh ${ds.lastRefresh}`}
                      {ds.rowsInserted && ` · ${ds.rowsInserted} rows`}
                      {ds.incrementalColumn && ` · incremental on ${ds.incrementalColumn}`}
                      {ds.hasExtractFilters && ' · extract filters applied'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
