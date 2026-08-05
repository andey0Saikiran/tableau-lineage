import { ChevronDown, Copy, Database, Server } from 'lucide-react';
import type { SqlExtractResult, SqlConnection } from '../lib/sqlExtractor';

interface Props {
  sql: SqlExtractResult | null;
  toast: (msg: string, kind?: 'info' | 'success' | 'error') => void;
}

function ConnChip({ conn }: { conn: SqlConnection | null }) {
  if (!conn) return null;
  const parts = [conn.class, conn.dbname, conn.server && `@ ${conn.server}`].filter(Boolean);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
      <Server className="h-3 w-3" /> {parts.join(' · ')}
    </span>
  );
}

function CopyButton({ text, toast }: { text: string; toast: Props['toast'] }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => toast('SQL copied to clipboard', 'success'))
          .catch(() => toast('Could not copy', 'error'));
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-brand-500 hover:text-brand-600"
    >
      <Copy className="h-3 w-3" /> Copy
    </button>
  );
}

function SqlBlock({ sqlText }: { sqlText: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-slate-50 p-3 text-[12.5px] leading-relaxed text-ink">
      <code>{sqlText}</code>
    </pre>
  );
}

/**
 * Shows every SQL statement stored in the workbook (Custom SQL, Initial SQL,
 * stored procedures, RAWSQL calcs). Renders nothing when the workbook has none,
 * which is the common case — most workbooks use direct table relations.
 */
export function SqlPanel({ sql, toast }: Props) {
  if (!sql || !sql.has_sql) return null;

  const chips = [
    sql.custom_sql.length && `${sql.custom_sql.length} custom SQL`,
    sql.initial_sql.length && `${sql.initial_sql.length} initial SQL`,
    sql.stored_procedures.length && `${sql.stored_procedures.length} stored proc`,
    sql.rawsql_calculations.length && `${sql.rawsql_calculations.length} RAWSQL`,
  ].filter(Boolean) as string[];

  return (
    <details className="group rounded-2xl border border-border bg-white/80 shadow-sm backdrop-blur-sm open:border-brand-400">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-leaf text-white">
          <Database className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">SQL in this workbook</span>
          <span className="block truncate text-xs text-muted">{chips.join(' · ')}</span>
        </span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-brand-600 transition-transform duration-300 group-open:rotate-180" />
      </summary>

      <div className="space-y-5 border-t border-border/70 px-5 pb-5 pt-4">
        {sql.custom_sql.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Custom SQL queries</h3>
            {sql.custom_sql.map((q, i) => (
              <div key={`${q.datasource}-${i}`} className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{q.relation_name}</span>
                  <span className="text-xs text-muted">in {q.datasource}</span>
                  <ConnChip conn={q.connection} />
                  <CopyButton text={q.sql} toast={toast} />
                </div>
                <SqlBlock sqlText={q.sql} />
              </div>
            ))}
          </div>
        )}

        {sql.initial_sql.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
              Initial SQL (runs when the connection opens)
            </h3>
            {sql.initial_sql.map((q, i) => (
              <div key={`${q.datasource}-${i}`} className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">{q.datasource}</span>
                  <ConnChip conn={q.connection} />
                  <CopyButton text={q.sql} toast={toast} />
                </div>
                <SqlBlock sqlText={q.sql} />
              </div>
            ))}
          </div>
        )}

        {sql.stored_procedures.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Stored procedures</h3>
            {sql.stored_procedures.map((sp, i) => (
              <div key={`${sp.name}-${i}`} className="mt-3 flex flex-wrap items-center gap-2">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-ink">{sp.name}</code>
                <span className="text-xs text-muted">in {sp.datasource}</span>
                <ConnChip conn={sp.connection} />
                {sp.parameters.map((p) => (
                  <span key={p.name} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-muted">
                    {p.name} = {p.value}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        {sql.rawsql_calculations.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
              RAWSQL calculated fields
            </h3>
            {sql.rawsql_calculations.map((f, i) => (
              <div key={`${f.field_name}-${i}`} className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{f.field_name}</span>
                  <span className="text-xs text-muted">in {f.datasource}</span>
                  <CopyButton text={f.formula} toast={toast} />
                </div>
                <SqlBlock sqlText={f.formula} />
              </div>
            ))}
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted">
          Note: a workbook stores only SQL its author wrote. Queries Tableau generates at runtime
          for live connections are not saved in the file.
        </p>
      </div>
    </details>
  );
}
