import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Cpu, Share2 } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { FileUpload } from './components/FileUpload';
import { HeroGraph } from './components/HeroGraph';
import { StatsGrid, type HighlightType } from './components/StatsGrid';
import { ResultActions } from './components/ResultActions';
import { SeoContent } from './components/SeoContent';
import { VisualizerFrame } from './components/VisualizerFrame';
import { AboutPanel, PrivacyPanel } from './components/Panels';
import { BackgroundEffects } from './components/BackgroundEffects';
import { useToast } from './components/Toast';
import { useWorkbook } from './hooks/useWorkbook';
import { makeT, type Language } from './lib/i18n';
import { trackEvent } from './lib/analytics';

// Reach into the same-origin report iframe to drive graph highlighting.
type ReportWindow = Window & { tlHighlightType?: (type: string) => void };

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<HighlightType | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const t = useMemo(() => makeT(language), [language]);
  const { showToast, ToastViewport } = useToast();
  const { status, result, reportHtml, error, analyze, reset, clearError } = useWorkbook();

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

      <Header
        t={t}
        language={language}
        onLanguage={setLanguage}
        onAbout={() => setAboutOpen(true)}
        onPrivacy={() => setPrivacyOpen(true)}
      />

      <main className="relative z-10 flex-1">
        {!showResults ? (
          <>
          <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-8 lg:min-h-[calc(100vh-65px)] lg:grid-cols-2 lg:gap-14 lg:py-0">
            {/* Pitch + how-it-works (second on mobile so the upload is reached first) */}
            <div className="order-2 lg:order-1">
              <h1 className="text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-[2.85rem] lg:leading-[1.06]">
                See the dependencies inside any Tableau workbook
              </h1>
              <p className="mt-4 max-w-lg text-pretty text-[15px] leading-relaxed text-muted">
                Map calculated-field lineage, parameters, and metadata from a{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-ink">.twbx</code>,
                rendered as an interactive graph and a searchable dictionary, entirely in your browser.
              </p>

              <HeroGraph className="mt-6 max-w-xs animate-fade-in" />

              <ol className="mt-7 space-y-3">
                {[
                  { Icon: FileUp, title: 'Drop a .twbx', body: 'Pick any Tableau packaged workbook.' },
                  { Icon: Cpu, title: 'Parsed in your browser', body: 'Read locally. It never leaves your machine.' },
                  { Icon: Share2, title: 'Explore the lineage', body: 'Graph + dictionary, then export a report.' },
                ].map(({ Icon, title, body }, i) => (
                  <li key={title} className="flex items-center gap-3">
                    <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-leaf text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm">
                      <b className="text-ink">
                        {i + 1}. {title}
                      </b>
                      <span className="text-muted"> — {body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

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

            <StatsGrid stats={result.stats} t={t} selected={selectedType} onSelect={handleSelectType} />

            <ResultActions
              t={t}
              result={result}
              reportHtml={reportHtml}
              onReset={() => {
                reset();
                showToast(t('readyForNew'));
              }}
              toast={showToast}
            />

            <VisualizerFrame ref={iframeRef} html={reportHtml} title={`${result.fileLabel} — lineage`} />
          </section>
        )}
      </main>

      <Footer t={t} />

      <AboutPanel open={aboutOpen} onClose={() => setAboutOpen(false)} t={t} />
      <PrivacyPanel open={privacyOpen} onClose={() => setPrivacyOpen(false)} t={t} />
      {ToastViewport}
    </div>
  );
}
