import { SlideOver } from './SlideOver';
import { Info, ShieldCheck, Sparkles, Share2, Filter, Database, Download, Terminal, Globe, GitCompare } from 'lucide-react';
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
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
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
          Drop in a Tableau workbook and this tool audits it (what nothing uses, what is duplicated,
          what will be slow) and maps every calculated field, its formula, and what it depends on as
          an interactive dependency graph and a searchable data dictionary. Filters, dashboards, data
          sources and any stored SQL are surfaced alongside, and you can compare versions to see what
          changed between them.
        </p>

        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">How it works</h3>
          <ol className="space-y-3">
            <Step n={1} title="Choose a .twbx" body="Drag it in or pick it from your device." />
            <Step n={2} title="Parsed in your browser" body="The workbook is unzipped and its XML read locally. Nothing is uploaded." />
            <Step n={3} title="Audit, explore, export" body="Read the audit, walk the graph or dictionary, then download an interactive HTML report, a Markdown handover doc, CSV or JSON." />
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
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-700"
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
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-700"
        >
          Verify it yourself on GitHub →
        </a>
      </div>
    </SlideOver>
  );
}

function FeatureGroup({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: React.ReactNode[];
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        {icon} {title}
      </h3>
      <ul className="space-y-1.5 text-sm text-muted">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-400" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FeaturesPanel({ open, onClose, t }: PanelProps) {
  const b = (s: string) => <b className="text-ink">{s}</b>;
  return (
    <SlideOver open={open} onClose={onClose} title={t('featuresTitle')} icon={<Sparkles className="h-5 w-5 text-brand-600" />}>
      <div className="space-y-7 text-[15px] leading-relaxed text-ink">
        <p className="text-muted">
          Everything the tool finds in a <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-ink">.twbx</code>,
          all parsed in your browser with nothing uploaded.
        </p>

        <FeatureGroup
          icon={<ShieldCheck className="h-4 w-4 text-rose-600" />}
          title="Audit"
          items={[
            <>{b('Dead weight')}: every field and parameter nothing uses, graded by confidence with the reason spelled out. Candidates to review, not a blind delete list.</>,
            <>{b('Duplicate calculations')}: identical formulas under different names, and the riskier case of one name carrying different formulas.</>,
            <>{b('Performance lint')}: 15 rules over what the file contains. Heavy and nested LODs, long calculations, string-heavy work, too many quick filters, missing context filters, live connections, non-fixed dashboard sizing and dense dashboards, each with a fix.</>,
          ]}
        />

        <FeatureGroup
          icon={<GitCompare className="h-4 w-4 text-violet-600" />}
          title="Compare versions"
          items={[
            <>Drop in up to {b('five versions')} of the same dashboard and see what changed at each step.</>,
            <>Calculations {b('added, removed, renamed or edited')}, and for every edit the downstream fields it can break.</>,
            <>Reformatting is not reported as a change, and a renamed field is reported as a rename rather than an unrelated add and remove.</>,
          ]}
        />

        <FeatureGroup
          icon={<Share2 className="h-4 w-4 text-brand-600" />}
          title="Lineage & analysis"
          items={[
            <>{b('Interactive dependency graph')}: every field, calculation, parameter, and worksheet as nodes; edges show what feeds what. Cluster, search, zoom, physics.</>,
            <>{b('Dashboards and provenance')}: which sheets each dashboard places, sheets on no dashboard, hidden sheets, and whether each data source is an extract or live.</>,
            <>{b('Searchable data dictionary')}: every formula grouped by data source, plus per-worksheet sections.</>,
            <>{b('Seven clickable metrics')}: data sources, calculated fields, raw fields, parameters, LOD calcs, table calcs, filters. Click one to highlight or drill in.</>,
            <>{b('Field classification')}: calculated vs raw vs parameter, with LOD and table-calc detection.</>,
          ]}
        />

        <FeatureGroup
          icon={<Filter className="h-4 w-4 text-cyan-600" />}
          title="Filters & worksheets"
          items={[
            <>{b('Every filter, deduplicated')}: the field it acts on, its kind (categorical, quantitative, relative-date), context-filter status, selected values, and ranges.</>,
            <>{b('Per-worksheet breakdown')}: expand any sheet to see exactly what it filters on; data-source filters called out separately.</>,
            <>{b('Worksheet usage')}: which fields each worksheet uses, in the graph, the dictionary, and the exports.</>,
          ]}
        />

        <FeatureGroup
          icon={<Database className="h-4 w-4 text-violet-600" />}
          title="Stored SQL"
          items={[
            <>{b('Custom SQL queries')} in full text, {b('Initial SQL')}, {b('stored procedures')} with parameters, and {b('RAWSQL calculated fields')}.</>,
            <>Each statement mapped to the {b('database connection')} it targets (class, database, server), with one-click copy.</>,
          ]}
        />

        <FeatureGroup
          icon={<Download className="h-4 w-4 text-emerald-600" />}
          title="Exports"
          items={[
            <>{b('Interactive HTML report')}: self-contained and offline-ready, the same graph and dictionary in one shareable file.</>,
            <>{b('Markdown handover document')}: the workbook written up for a ticket, a wiki or a README, and the format an AI assistant reads best.</>,
            <>{b('CSV')} field inventory (with worksheet usage) and {b('JSON')} of the complete model, audit included.</>,
          ]}
        />

        <FeatureGroup
          icon={<Terminal className="h-4 w-4 text-ink" />}
          title="AI assistants (MCP)"
          items={[
            <>
              The same engine ships as{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px] text-ink">tableau-lineage-mcp</code>, so
              Claude, Cursor, and other MCP clients can read workbooks on your machine.
            </>,
            <>{b('11 tools')}: audit, version diff, analyze, list calculations, field detail, dependency tracing, parameters, lineage graph, SQL, filters, worksheets.</>,
            <>Runs {b('100% locally')}, same as the site: the workbook never leaves your computer.</>,
          ]}
        />

        <FeatureGroup
          icon={<Globe className="h-4 w-4 text-amber-600" />}
          title="Practical"
          items={[
            <>Workbooks up to {b('500 MB')} (only the workbook XML is ever decompressed).</>,
            <>{b('Seven interface languages')} for the core interface strings, keyboard navigation, AA contrast, reduced-motion support.</>,
            <>{b('Free and open source')}: no account, no cookies, verifiable code.</>,
          ]}
        />

        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-700"
        >
          Explore the code on GitHub →
        </a>
      </div>
    </SlideOver>
  );
}
