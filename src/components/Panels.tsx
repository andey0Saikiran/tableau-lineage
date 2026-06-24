import { SlideOver } from './SlideOver';
import { Info, ShieldCheck } from 'lucide-react';
import { REPO_URL } from '../lib/site';
import type { TranslationKey } from '../lib/i18n';

interface PanelProps {
  open: boolean;
  onClose: () => void;
  t: (k: TranslationKey) => string;
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
        {n}
      </span>
      <span>
        <span className="font-semibold text-ink">{title}</span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
    </li>
  );
}

export function AboutPanel({ open, onClose, t }: PanelProps) {
  return (
    <SlideOver open={open} onClose={onClose} title={t('aboutTitle')} icon={<Info className="h-5 w-5 text-brand-600" />}>
      <div className="space-y-7 text-[15px] leading-relaxed text-ink">
        <p className="text-muted">
          Drop in a Tableau workbook and this tool maps every calculated field, its formula, and what
          it depends on — raw fields, parameters, LOD and table calculations — as an interactive
          dependency graph and a searchable data dictionary.
        </p>

        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">How it works</h3>
          <ol className="space-y-3">
            <Step n={1} title="Choose a .twbx" body="Drag it in or pick it from your device." />
            <Step n={2} title="Parsed in your browser" body="The workbook is unzipped and its XML read locally. Nothing is uploaded." />
            <Step n={3} title="Explore & export" body="Walk the graph or dictionary, then download a self-contained interactive HTML report, plus CSV or JSON." />
          </ol>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">In the graph</h3>
          <ul className="space-y-1.5 text-sm text-muted">
            <li>• Click a node to highlight its dependency chain and open details.</li>
            <li>• Double-click to zoom; drag to pan; scroll to zoom.</li>
            <li>• Collapse data sources into clusters, search, and reset.</li>
            <li>• Shortcuts: <kbd className="rounded border border-border bg-slate-50 px-1.5 py-0.5 text-xs">⌘/Ctrl + F</kbd> search, <kbd className="rounded border border-border bg-slate-50 px-1.5 py-0.5 text-xs">Esc</kbd> clear.</li>
          </ul>
        </section>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          View the source on GitHub →
        </a>
      </div>
    </SlideOver>
  );
}

export function PrivacyPanel({ open, onClose, t }: PanelProps) {
  return (
    <SlideOver open={open} onClose={onClose} title={t('privacyTitle')} icon={<ShieldCheck className="h-5 w-5 text-emerald-600" />}>
      <div className="space-y-6 text-[15px] leading-relaxed text-ink">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="font-bold text-emerald-800">{t('privacyNoticeTitle')}</h3>
          <p className="mt-1.5 text-sm text-emerald-900/90">{t('privacyNotice')}</p>
        </div>

        <ul className="space-y-3 text-sm text-muted">
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span><b className="text-ink">Processed in your browser.</b> Your `.twbx` is read with your device's own CPU. It is never sent to a server — there is no server.</span>
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span><b className="text-ink">No storage, no logging.</b> Nothing about your file is saved or recorded, here or anywhere.</span>
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span><b className="text-ink">No cookies, no tracking.</b> The only thing collected is an anonymous, aggregate page-view count — no cookies, no personal data.</span>
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span><b className="text-ink">Open source.</b> You can read exactly what runs.</span>
          </li>
        </ul>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Verify it yourself on GitHub →
        </a>
      </div>
    </SlideOver>
  );
}
