import { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { FileUpload } from './components/FileUpload';
import { HeroGraph } from './components/HeroGraph';
import { HowItWorks } from './components/HowItWorks';
import { StatsGrid, type HighlightType } from './components/StatsGrid';
import { ResultActions } from './components/ResultActions';
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

  // New result → clear any active highlight.
  useEffect(() => setSelectedType(null), [reportHtml]);

  const handleSelectType = (type: HighlightType) => {
    const next = selectedType === type ? null : type;
    setSelectedType(next);
    try {
      (iframeRef.current?.contentWindow as ReportWindow | undefined)?.tlHighlightType?.(next ?? 'reset');
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
          <section className="mx-auto max-w-3xl px-5 pb-12 pt-12 sm:pt-16">
            <div className="mb-7 flex flex-col items-center text-center">
              <HeroGraph className="mb-6 w-full max-w-sm animate-fade-in" />
              <h1 className="text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-[2.6rem] sm:leading-[1.1]">
                See the dependencies inside any Tableau workbook
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted">
                Map calculated-field lineage, parameters, and metadata from a{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-ink">.twbx</code>,
                rendered as an interactive graph and a searchable dictionary, entirely in your browser.
              </p>
            </div>

            <div className="mx-auto max-w-2xl">
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

            <HowItWorks />
          </section>
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
