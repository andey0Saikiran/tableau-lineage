import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal, Copy, Download } from 'lucide-react';
import { Header } from './components/Header';
import { AnnouncementBar } from './components/AnnouncementBar';
import { Footer } from './components/Footer';
import { ConnectCard } from './components/ConnectCard';
import { CompareCta } from './components/CompareCta';
import { MCPB_DOWNLOAD_URL } from './lib/site';

// Result panels only exist after a workbook is analysed, so they are split out
// of the landing-page bundle. Keeping the entry chunk small is a hard budget:
// it is the only JavaScript a first-time visitor (and Google) has to download.
const SqlPanel = lazy(() => import('./components/SqlPanel').then((m) => ({ default: m.SqlPanel })));
const FiltersPanel = lazy(() =>
  import('./components/FiltersPanel').then((m) => ({ default: m.FiltersPanel })),
);
const AuditPanel = lazy(() =>
  import('./components/AuditPanel').then((m) => ({ default: m.AuditPanel })),
);
const StructurePanel = lazy(() =>
  import('./components/StructurePanel').then((m) => ({ default: m.StructurePanel })),
);
const ComparePanel = lazy(() =>
  import('./components/ComparePanel').then((m) => ({ default: m.ComparePanel })),
);
import { FileUpload } from './components/FileUpload';
import { LandingCopy } from './components/LandingCopy';
import { StatsGrid, type HighlightType } from './components/StatsGrid';
import { ResultActions } from './components/ResultActions';
import { SeoContent } from './components/SeoContent';
import { VisualizerFrame } from './components/VisualizerFrame';
import { AboutPanel, PrivacyPanel, FeaturesPanel } from './components/Panels';
import { BackgroundEffects } from './components/BackgroundEffects';
import { useToast } from './components/Toast';
import { useWorkbook } from './hooks/useWorkbook';
import { useCompare } from './hooks/useCompare';
import { makeT, type Language } from './lib/i18n';
import { trackEvent } from './lib/analytics';

// Reach into the same-origin report iframe to drive graph highlighting.
type ReportWindow = Window & { tlHighlightType?: (type: string) => void };

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<HighlightType | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const t = useMemo(() => makeT(language), [language]);
  const { showToast, ToastViewport } = useToast();
  const {
    status, result, sql, filters, audit, dashboards, provenance,
    reportHtml, error, analyze, reset, clearError,
  } = useWorkbook();
  const { steps: diffSteps, busy: comparing, error: compareError, compare, resetCompare } = useCompare();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Fire only on the transition into "done" (not on every render where status is
  // already done — e.g. a language change would otherwise re-toast).
  const prevStatus = useRef(status);
  useEffect(() => {
    if (status === 'done' && prevStatus.current !== 'done') {
      showToast(t('workbookAnalyzed'), 'success');
    }
    prevStatus.current = status;
  }, [status, showToast, t]);

  // When results appear (or we reset), put the viewport at the top so the user
  // lands on the stats, not scrolled down into the tall graph.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [status]);

  // New result → clear any active highlight.
  useEffect(() => setSelectedType(null), [reportHtml]);

  const handleSelectType = (type: HighlightType) => {
    // Filters aren't graph nodes — the card opens the per-worksheet breakdown.
    if (type === 'filter') {
      const panel = document.getElementById('filters-panel');
      panel?.setAttribute('open', '');
      panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const next = selectedType === type ? null : type;
    setSelectedType(next);
    try {
      (iframeRef.current?.contentWindow as ReportWindow | undefined)?.tlHighlightType?.(next ?? 'reset');
      // Bring the graph into view so the highlight is actually visible, rather
      // than letting the iframe focus quietly scroll the page to its bottom.
      if (next) iframeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      /* iframe not ready yet — harmless */
    }
  };

  const tryDemo = async () => {
    trackEvent('try_demo');
    try {
      const res = await fetch('/demo.twbx');
      if (!res.ok) throw new Error('demo unavailable');
      const blob = await res.blob();
      await analyze(new File([blob], 'Sample Workbook.twbx', { type: 'application/octet-stream' }));
    } catch {
      showToast('Sample workbook is unavailable', 'error');
    }
  };

  const showResults = status === 'done' && result && reportHtml;

  return (
    <div className="relative flex min-h-screen flex-col">
      <BackgroundEffects />

      <AnnouncementBar />

      <Header
        t={t}
        language={language}
        onLanguage={setLanguage}
        onFeatures={() => setFeaturesOpen(true)}
        onAbout={() => setAboutOpen(true)}
        onPrivacy={() => setPrivacyOpen(true)}
      />

      <main className="relative z-10 flex-1">
        {compareOpen ? (
          <Suspense fallback={null}>
            <ComparePanel
              onCompare={(fs) => {
                trackEvent('compare');
                compare(fs);
              }}
              steps={diffSteps}
              busy={comparing}
              error={compareError}
              onClose={() => {
                setCompareOpen(false);
                resetCompare();
              }}
            />
          </Suspense>
        ) : !showResults ? (
          <>
          <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-8 lg:min-h-[calc(100vh-65px)] lg:grid-cols-2 lg:gap-14 lg:py-0">
            <LandingCopy />

            {/* Upload — first on mobile, right column on desktop */}
            <div className="order-1 lg:order-2">
              <FileUpload
                t={t}
                status={status}
                error={error}
                onAnalyze={(f) => {
                  trackEvent('analyze');
                  analyze(f);
                }}
                onClearError={clearError}
                onTryDemo={tryDemo}
              />

              <CompareCta onOpen={() => setCompareOpen(true)} />

              {/* MCP callout: the AI-assistant path, right under the upload card */}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-2xl border border-border bg-white/70 p-4 shadow-sm backdrop-blur-sm">
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-ink text-white">
                  <Terminal className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">Works with Claude and Cursor via MCP</p>
                  <p className="text-xs text-muted">
                    Let your AI assistant audit and read workbooks on your machine: 11 tools, nothing uploaded.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* One-click path first: most people are on Claude Desktop and
                      should not have to open a terminal to try this. */}
                  <a
                    href={MCPB_DOWNLOAD_URL}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-700"
                  >
                    <Download className="h-3 w-3" /> Claude Desktop extension
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard
                        .writeText('claude mcp add tableau-lineage -- npx -y tableau-lineage-mcp')
                        .then(() => showToast('Install command copied', 'success'))
                        .catch(() => showToast('Could not copy', 'error'));
                    }}
                    title="Copy the install command for Claude Code or Cursor"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 font-mono text-xs text-ink transition-colors hover:border-brand-500 hover:text-brand-600"
                  >
                    <Copy className="h-3 w-3 text-brand-600" /> tableau-lineage-mcp
                  </button>
                  <a
                    href="https://github.com/andey0Saikiran/tableau-lineage/tree/main/mcp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap text-xs font-semibold text-brand-600 underline decoration-brand-400/50 underline-offset-2 hover:text-brand-700"
                  >
                    Set it up →
                  </a>
                </div>
              </div>
            </div>
          </section>
          <SeoContent />
          </>
        ) : (
          <section className="mx-auto max-w-[96rem] space-y-5 px-4 pb-12 pt-8 sm:px-6">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="font-semibold text-ink">{result.fileLabel}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Analyzed locally
              </span>
            </div>

            <StatsGrid stats={result.stats} filtersCount={filters?.count ?? 0} t={t} selected={selectedType} onSelect={handleSelectType} />

            <ResultActions
              t={t}
              bundle={{ result, audit, filters, sql, dashboards, provenance }}
              reportHtml={reportHtml}
              onReset={() => {
                reset();
                showToast(t('readyForNew'));
              }}
              toast={showToast}
            />

            <Suspense fallback={null}>
              <AuditPanel audit={audit} toast={showToast} />
              <StructurePanel dashboards={dashboards} provenance={provenance} />
              <FiltersPanel filters={filters} />
              <SqlPanel sql={sql} toast={showToast} />
            </Suspense>

            <VisualizerFrame ref={iframeRef} html={reportHtml} title={`${result.fileLabel} — lineage`} />

            <ConnectCard />
          </section>
        )}
      </main>

      <Footer t={t} />

      <FeaturesPanel open={featuresOpen} onClose={() => setFeaturesOpen(false)} t={t} />
      <AboutPanel open={aboutOpen} onClose={() => setAboutOpen(false)} t={t} />
      <PrivacyPanel open={privacyOpen} onClose={() => setPrivacyOpen(false)} t={t} />
      {ToastViewport}
    </div>
  );
}
