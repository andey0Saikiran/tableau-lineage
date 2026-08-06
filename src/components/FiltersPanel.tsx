import { ChevronDown, Filter, Layers, Database } from 'lucide-react';
import type { FilterExtractResult, WorkbookFilter } from '../lib/filterExtractor';

interface Props {
  filters: FilterExtractResult | null;
}

const KIND_STYLES: Record<string, string> = {
  categorical: 'bg-cyan-50 text-cyan-700',
  quantitative: 'bg-violet-50 text-violet-700',
  'relative-date': 'bg-amber-50 text-amber-700',
};

function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLES[kind] ?? 'bg-slate-100 text-muted'}`}
    >
      {kind}
    </span>
  );
}

function FilterRow({ f, showWorksheets }: { f: WorkbookFilter; showWorksheets: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5">
      <span className="text-sm font-semibold text-ink">{f.field}</span>
      <KindBadge kind={f.kind} />
      {f.is_context && (
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
          context
        </span>
      )}
      {f.members.length > 0 && (
        <span className="text-xs text-muted">
          = {f.members.slice(0, 6).join(', ')}
          {f.members.length > 6 && ` +${f.members.length - 6} more`}
        </span>
      )}
      {f.range && (f.range.min || f.range.max) && (
        <span className="text-xs text-muted">
          range {f.range.min ?? '…'} – {f.range.max ?? '…'}
        </span>
      )}
      {showWorksheets && (
        <span className="text-xs text-muted">
          on {f.worksheets.slice(0, 3).join(', ')}
          {f.worksheets.length > 3 && ` +${f.worksheets.length - 3} more sheets`}
        </span>
      )}
    </div>
  );
}

/**
 * Collapsible filter breakdown: which fields drive the filtering, then the
 * per-worksheet sub-branches. Renders nothing when the workbook has no filters.
 */
export function FiltersPanel({ filters }: Props) {
  if (!filters || filters.count === 0) return null;

  // Invert filter→worksheets into worksheet→filters for the sub-branching view.
  const byWorksheet = new Map<string, WorkbookFilter[]>();
  for (const f of filters.filters) {
    for (const ws of f.worksheets) {
      const list = byWorksheet.get(ws) ?? [];
      list.push(f);
      byWorksheet.set(ws, list);
    }
  }
  const worksheets = [...byWorksheet.keys()].sort((a, b) => {
    // Data-source filters first — they apply to everything downstream.
    if (a === '(data source filter)') return -1;
    if (b === '(data source filter)') return 1;
    return a.localeCompare(b);
  });
  const contextCount = filters.filters.filter((f) => f.is_context).length;

  return (
    <details
      id="filters-panel"
      className="group rounded-2xl border border-border bg-white/80 shadow-sm backdrop-blur-sm open:border-cyan-400"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-brand-500 text-white">
          <Filter className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">Filters in this workbook</span>
          <span className="block truncate text-xs text-muted">
            {filters.count} filter{filters.count === 1 ? '' : 's'} · {filters.fields_used.length} field
            {filters.fields_used.length === 1 ? '' : 's'}
            {contextCount > 0 && ` · ${contextCount} context`} · {worksheets.length} location
            {worksheets.length === 1 ? '' : 's'}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-cyan-600 transition-transform duration-300 group-open:rotate-180" />
      </summary>

      <div className="space-y-5 border-t border-border/70 px-5 pb-5 pt-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Fields used by filters</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.fields_used.map((f) => (
              <span key={f} className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            <Layers className="h-3.5 w-3.5" /> By worksheet
          </h3>
          <div className="mt-2 space-y-2">
            {worksheets.map((ws) => {
              const list = byWorksheet.get(ws)!;
              const isDsFilter = ws === '(data source filter)';
              return (
                <details
                  key={ws}
                  className="group/ws rounded-xl border border-border bg-white px-4 py-2.5"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                      {isDsFilter && <Database className="h-3.5 w-3.5 flex-shrink-0 text-violet-600" />}
                      <span className="truncate">{isDsFilter ? 'Data source filters' : ws}</span>
                      <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-muted">
                        {list.length}
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted transition-transform duration-300 group-open/ws:rotate-180" />
                  </summary>
                  <div className="mt-1 divide-y divide-border/60">
                    {list.map((f) => (
                      <FilterRow key={`${f.datasource}-${f.field}-${f.kind}`} f={f} showWorksheets={false} />
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </details>
  );
}
