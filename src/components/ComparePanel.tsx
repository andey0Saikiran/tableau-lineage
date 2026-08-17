import { useRef, useState } from 'react';
import {
  ArrowRight,
  FilePlus2,
  GitCompare,
  Minus,
  Pencil,
  Plus,
  Tag,
  X,
  Zap,
} from 'lucide-react';
import type { WorkbookDiff } from '../lib/diff';

interface Props {
  onCompare: (before: File, after: File) => void;
  diff: WorkbookDiff | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
}

function DropSlot({
  label,
  file,
  onPick,
}: {
  label: string;
  file: File | null;
  onPick: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      className={`flex min-h-[5.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-3 text-center transition-colors ${
        over ? 'border-brand-500 bg-sky-50' : file ? 'border-brand-400 bg-white' : 'border-border bg-white/60 hover:border-brand-400'
      }`}
    >
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
      {file ? (
        <span className="max-w-full truncate text-sm font-semibold text-ink">{file.name}</span>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <FilePlus2 className="h-4 w-4" /> Drop a .twbx
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".twbx,.twb"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
    </button>
  );
}

function Section({
  icon,
  title,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${tone}`}>
        {icon} {title}
      </h4>
      <div className="mt-1.5 space-y-1">{children}</div>
    </div>
  );
}

function Formula({ children }: { children: string }) {
  return (
    <code className="block overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 px-2 py-1 font-mono text-[12px] text-ink">
      {children}
    </code>
  );
}

/**
 * Compare two versions of a workbook. A git diff of the raw XML drowns the
 * handful of real changes in layout noise, so this reports the semantic ones:
 * which calculations changed, what they break, and what moved.
 */
export function ComparePanel({ onCompare, diff, busy, error, onClose }: Props) {
  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);

  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">
      <div className="rounded-2xl border border-border bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink">
              <GitCompare className="h-5 w-5 text-brand-600" /> Compare two workbooks
            </h2>
            <p className="mt-1 text-sm text-muted">
              What changed between two versions: calculations, filters, sheets, SQL, and what each
              change breaks. Both files are read in your browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close compare"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <DropSlot label="Before" file={before} onPick={setBefore} />
          <ArrowRight className="mx-auto h-4 w-4 flex-shrink-0 rotate-90 text-muted sm:rotate-0" />
          <DropSlot label="After" file={after} onPick={setAfter} />
        </div>

        <button
          type="button"
          disabled={!before || !after || busy}
          onClick={() => before && after && onCompare(before, after)}
          className="mt-4 w-full rounded-xl bg-gradient-to-br from-brand-500 to-leaf px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Comparing…' : 'Compare workbooks'}
        </button>

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {diff && (
          <div className="mt-6 border-t border-border pt-5">
            {diff.identical ? (
              <p className="text-sm font-semibold text-emerald-700">
                No semantic differences. The two workbooks define the same calculations, filters,
                sheets and data sources.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-extrabold text-ink">{diff.totalChanges}</span>
                  <span className="text-sm text-muted">
                    change{diff.totalChanges === 1 ? '' : 's'} between{' '}
                    <b className="text-ink">{diff.before}</b> and <b className="text-ink">{diff.after}</b>
                  </span>
                </div>

                {diff.headline.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-xl bg-amber-50 px-4 py-3">
                    {diff.headline.map((h) => (
                      <li key={h} className="flex gap-2 text-sm text-amber-900">
                        <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {h}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-5 space-y-5">
                  {diff.calculations.modified.length > 0 && (
                    <Section icon={<Pencil className="h-3.5 w-3.5" />} title="Changed calculations" tone="text-amber-700">
                      {diff.calculations.modified.map((m) => (
                        <div key={`${m.datasource}-${m.name}`} className="rounded-xl border border-border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-ink">{m.name}</span>
                            {m.impact.length > 0 && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                affects {m.impact.length} downstream
                              </span>
                            )}
                          </div>
                          <div className="mt-2 space-y-1">
                            <span className="text-[11px] font-semibold uppercase text-muted">Before</span>
                            <Formula>{m.beforeFormula}</Formula>
                            <span className="text-[11px] font-semibold uppercase text-muted">After</span>
                            <Formula>{m.afterFormula}</Formula>
                          </div>
                          {m.impact.length > 0 && (
                            <p className="mt-2 text-xs text-muted">
                              Downstream: {m.impact.slice(0, 8).join(', ')}
                              {m.impact.length > 8 && ` +${m.impact.length - 8} more`}
                            </p>
                          )}
                        </div>
                      ))}
                    </Section>
                  )}

                  {diff.calculations.renamed.length > 0 && (
                    <Section icon={<Tag className="h-3.5 w-3.5" />} title="Renamed" tone="text-violet-700">
                      {diff.calculations.renamed.map((r) => (
                        <p key={r.afterName} className="text-sm text-ink">
                          <span className="text-muted line-through">{r.beforeName}</span>{' '}
                          <ArrowRight className="inline h-3 w-3 text-muted" />{' '}
                          <b>{r.afterName}</b>
                        </p>
                      ))}
                    </Section>
                  )}

                  {diff.calculations.added.length > 0 && (
                    <Section icon={<Plus className="h-3.5 w-3.5" />} title="Added calculations" tone="text-emerald-700">
                      {diff.calculations.added.map((f) => (
                        <div key={`${f.datasource}-${f.field_name}`}>
                          <p className="text-sm font-semibold text-ink">{f.field_name}</p>
                          <Formula>{f.formula}</Formula>
                        </div>
                      ))}
                    </Section>
                  )}

                  {diff.calculations.removed.length > 0 && (
                    <Section icon={<Minus className="h-3.5 w-3.5" />} title="Removed calculations" tone="text-rose-700">
                      {diff.calculations.removed.map((f) => (
                        <p key={`${f.datasource}-${f.field_name}`} className="text-sm text-ink">
                          {f.field_name}
                        </p>
                      ))}
                    </Section>
                  )}

                  {(diff.filters.added.length > 0 ||
                    diff.filters.removed.length > 0 ||
                    diff.filters.changed.length > 0) && (
                    <Section icon={<Pencil className="h-3.5 w-3.5" />} title="Filters" tone="text-cyan-700">
                      {diff.filters.changed.map((f) => (
                        <p key={`c-${f.worksheet}-${f.field}`} className="text-sm text-ink">
                          <b>{f.field}</b> on {f.worksheet}:{' '}
                          <span className="text-muted">{f.before}</span>{' '}
                          <ArrowRight className="inline h-3 w-3" /> {f.after}
                        </p>
                      ))}
                      {diff.filters.added.map((f) => (
                        <p key={`a-${f.worksheet}-${f.field}`} className="text-sm text-emerald-700">
                          + <b>{f.field}</b> on {f.worksheet}
                        </p>
                      ))}
                      {diff.filters.removed.map((f) => (
                        <p key={`r-${f.worksheet}-${f.field}`} className="text-sm text-rose-700">
                          − <b>{f.field}</b> on {f.worksheet}
                        </p>
                      ))}
                    </Section>
                  )}

                  {(diff.worksheets.added.length > 0 || diff.worksheets.removed.length > 0) && (
                    <Section icon={<Plus className="h-3.5 w-3.5" />} title="Worksheets" tone="text-teal-700">
                      {diff.worksheets.added.map((w) => (
                        <p key={w} className="text-sm text-emerald-700">+ {w}</p>
                      ))}
                      {diff.worksheets.removed.map((w) => (
                        <p key={w} className="text-sm text-rose-700">− {w}</p>
                      ))}
                    </Section>
                  )}

                  {(diff.dashboards.added.length > 0 ||
                    diff.dashboards.removed.length > 0 ||
                    diff.dashboards.changed.length > 0) && (
                    <Section icon={<Plus className="h-3.5 w-3.5" />} title="Dashboards" tone="text-violet-700">
                      {diff.dashboards.added.map((d) => (
                        <p key={d} className="text-sm text-emerald-700">+ {d}</p>
                      ))}
                      {diff.dashboards.removed.map((d) => (
                        <p key={d} className="text-sm text-rose-700">− {d}</p>
                      ))}
                      {diff.dashboards.changed.map((d) => (
                        <p key={d.name} className="text-sm text-ink">
                          <b>{d.name}</b>
                          {d.addedSheets.length > 0 && (
                            <span className="text-emerald-700"> +{d.addedSheets.join(', ')}</span>
                          )}
                          {d.removedSheets.length > 0 && (
                            <span className="text-rose-700"> −{d.removedSheets.join(', ')}</span>
                          )}
                        </p>
                      ))}
                    </Section>
                  )}

                  {(diff.parameters.valueChanged.length > 0 ||
                    diff.parameters.added.length > 0 ||
                    diff.parameters.removed.length > 0) && (
                    <Section icon={<Pencil className="h-3.5 w-3.5" />} title="Parameters" tone="text-pink-700">
                      {diff.parameters.valueChanged.map((p) => (
                        <p key={p.name} className="text-sm text-ink">
                          <b>{p.name}</b>: {p.before} <ArrowRight className="inline h-3 w-3" /> {p.after}
                        </p>
                      ))}
                      {diff.parameters.added.map((p) => (
                        <p key={p.name} className="text-sm text-emerald-700">+ {p.name}</p>
                      ))}
                      {diff.parameters.removed.map((p) => (
                        <p key={p.name} className="text-sm text-rose-700">− {p.name}</p>
                      ))}
                    </Section>
                  )}

                  {(diff.sql.changed.length > 0 ||
                    diff.sql.added.length > 0 ||
                    diff.sql.removed.length > 0) && (
                    <Section icon={<Pencil className="h-3.5 w-3.5" />} title="Stored SQL" tone="text-violet-700">
                      {diff.sql.changed.map((k) => (
                        <p key={k} className="text-sm text-ink">changed: {k}</p>
                      ))}
                      {diff.sql.added.map((k) => (
                        <p key={k} className="text-sm text-emerald-700">+ {k}</p>
                      ))}
                      {diff.sql.removed.map((k) => (
                        <p key={k} className="text-sm text-rose-700">− {k}</p>
                      ))}
                    </Section>
                  )}

                  {(diff.datasources.changed.length > 0 ||
                    diff.datasources.added.length > 0 ||
                    diff.datasources.removed.length > 0) && (
                    <Section icon={<Pencil className="h-3.5 w-3.5" />} title="Data sources" tone="text-indigo-700">
                      {diff.datasources.changed.map((d, i) => (
                        <p key={`${d.name}-${i}`} className="text-sm text-ink">
                          <b>{d.name}</b>: {d.detail}
                        </p>
                      ))}
                      {diff.datasources.added.map((d) => (
                        <p key={d} className="text-sm text-emerald-700">+ {d}</p>
                      ))}
                      {diff.datasources.removed.map((d) => (
                        <p key={d} className="text-sm text-rose-700">− {d}</p>
                      ))}
                    </Section>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
