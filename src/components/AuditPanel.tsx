import { useState } from 'react';
import { AlertTriangle, ChevronDown, Copy, Info, Trash2, Copy as CopyIcon, Gauge } from 'lucide-react';
import type { AuditResult, DeadConfidence, LintSeverity } from '../lib/audit';

interface Props {
  audit: AuditResult | null;
  toast: (msg: string, kind?: 'info' | 'success' | 'error') => void;
}

const CONFIDENCE_LABEL: Record<DeadConfidence, string> = {
  unused: 'Unused',
  'likely-unused': 'Likely unused',
  'referenced-in-comment': 'Only in a comment',
};

const CONFIDENCE_STYLE: Record<DeadConfidence, string> = {
  unused: 'bg-rose-50 text-rose-700',
  'likely-unused': 'bg-amber-50 text-amber-700',
  'referenced-in-comment': 'bg-slate-100 text-muted',
};

const SEVERITY_STYLE: Record<LintSeverity, string> = {
  high: 'bg-rose-50 text-rose-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-slate-100 text-muted',
};

/** Collapsible list that only renders the long tail once asked. */
function Expandable<T>({
  items,
  initial = 8,
  render,
  moreLabel,
}: {
  items: T[];
  initial?: number;
  render: (item: T, i: number) => React.ReactNode;
  moreLabel: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, initial);
  return (
    <>
      {shown.map(render)}
      {items.length > initial && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-muted transition-colors hover:bg-slate-200"
        >
          {open ? 'Show less' : moreLabel(items.length - initial)}
        </button>
      )}
    </>
  );
}

export function AuditPanel({ audit, toast }: Props) {
  if (!audit) return null;
  const { dead, duplicates, lint } = audit;
  const hasFindings = dead.length > 0 || duplicates.length > 0 || lint.length > 0;
  if (!hasFindings && !audit.limited) return null;

  const copyDeadList = () => {
    const text = dead
      .map((d) => `${d.name}\t${d.datasource}\t${d.kind}\t${CONFIDENCE_LABEL[d.confidence]}`)
      .join('\n');
    navigator.clipboard
      .writeText(`Field\tData source\tType\tConfidence\n${text}`)
      .then(() => toast('Dead-weight list copied', 'success'))
      .catch(() => toast('Could not copy', 'error'));
  };

  return (
    <details
      id="audit-panel"
      className="group rounded-2xl border border-border bg-white/80 shadow-sm backdrop-blur-sm open:border-rose-300"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-amber-500 text-white">
          <Gauge className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">Workbook audit</span>
          <span className="block truncate text-xs text-muted">
            {dead.length > 0 && `${dead.length} unused (${audit.dead_weight_pct}% of fields)`}
            {dead.length > 0 && (duplicates.length > 0 || lint.length > 0) && ' · '}
            {duplicates.length > 0 && `${duplicates.length} duplicate group${duplicates.length === 1 ? '' : 's'}`}
            {duplicates.length > 0 && lint.length > 0 && ' · '}
            {lint.length > 0 && `${lint.length} performance finding${lint.length === 1 ? '' : 's'}`}
            {!hasFindings && 'Nothing to flag'}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-rose-500 transition-transform duration-300 group-open:rotate-180" />
      </summary>

      <div className="space-y-6 border-t border-border/70 px-5 pb-5 pt-4">
        {audit.limited && (
          <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {audit.limitations.join(' ')}
          </p>
        )}

        {/* Dead weight */}
        {dead.length > 0 && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                <Trash2 className="h-3.5 w-3.5" /> Unused fields
              </h3>
              <button
                type="button"
                onClick={copyDeadList}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-brand-500 hover:text-brand-700"
              >
                <Copy className="h-3 w-3" /> Copy list
              </button>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Nothing in the workbook references these. Review before deleting: this reads the
              workbook file only, so anything driven from outside it cannot be seen.
            </p>
            <div className="mt-2.5 divide-y divide-border/60">
              <Expandable
                items={dead}
                moreLabel={(n) => `Show ${n} more`}
                render={(d) => (
                  <div key={`${d.datasource}-${d.name}`} className="flex flex-wrap items-center gap-2 py-1.5">
                    <span className="text-sm font-semibold text-ink">{d.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONFIDENCE_STYLE[d.confidence]}`}>
                      {CONFIDENCE_LABEL[d.confidence]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-muted">{d.kind}</span>
                    {d.hidden && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-muted">hidden</span>
                    )}
                    <span className="text-xs text-muted">{d.datasource}</span>
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {/* Duplicates */}
        {duplicates.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <CopyIcon className="h-3.5 w-3.5" /> Duplicate calculations
            </h3>
            <div className="mt-2.5 space-y-2.5">
              {duplicates.map((g, i) => (
                <div key={i} className="rounded-xl border border-border bg-white px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        g.kind === 'same-name-different-formula'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {g.kind === 'same-name-different-formula'
                        ? 'Same name, different formula'
                        : 'Identical formula'}
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {g.members.map((m) => m.name).join(' · ')}
                    </span>
                  </div>
                  {g.kind === 'same-name-different-formula' ? (
                    <div className="mt-2 space-y-1.5">
                      {g.members.map((m, j) => (
                        <div key={j}>
                          <div className="text-[11px] font-semibold text-muted">{m.datasource}</div>
                          <pre className="overflow-x-auto rounded-lg border border-border bg-slate-50 p-2 text-[12px] text-ink">
                            <code>{m.formula}</code>
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-slate-50 p-2 text-[12px] text-ink">
                      <code>{g.members[0].formula}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance lint */}
        {lint.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <AlertTriangle className="h-3.5 w-3.5" /> Performance findings
            </h3>
            <div className="mt-2.5 space-y-2.5">
              {lint.map((f, i) => (
                <div key={i} className="rounded-xl border border-border bg-white px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_STYLE[f.severity]}`}>
                      {f.severity}
                    </span>
                    <span className="text-sm font-semibold text-ink">{f.title}</span>
                    <span className="text-xs text-muted">{f.subject}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{f.detail}</p>
                  {f.evidence && (
                    <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-border bg-slate-50 p-2 text-[12px] text-ink">
                      <code>{f.evidence}</code>
                    </pre>
                  )}
                  <p className="mt-1.5 text-xs leading-relaxed text-brand-700">
                    <b>Fix:</b> {f.fix}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
