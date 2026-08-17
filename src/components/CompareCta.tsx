import { ArrowRight, GitCompare } from 'lucide-react';

/**
 * Compare lived only as a header icon, where nobody would guess what it does,
 * and "compare two versions" on its own does not say versions of what. This
 * sits under the upload card at full width and names the thing being compared.
 */
export function CompareCta({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group mt-4 w-full rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-lg"
    >
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-brand-500 text-white shadow-md">
          <GitCompare className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold text-ink sm:text-lg">
            Compare versions of your dashboards
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Drop in any versions of the same dashboard, oldest first, and see exactly what changed:
            which calculations were edited, what those edits break downstream, and every filter,
            sheet and SQL change. Up to 5 versions at once.
          </p>
          <span className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-bold text-violet-700">
            Compare versions
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </button>
  );
}
