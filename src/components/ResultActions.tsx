import { Download, Table2, Braces, RefreshCw } from 'lucide-react';
import { downloadReportHtml, downloadCsv, downloadJson } from '../lib/exports';
import type { ExtractResult } from '../lib/types';
import type { TranslationKey } from '../lib/i18n';

interface Props {
  t: (k: TranslationKey) => string;
  result: ExtractResult;
  reportHtml: string;
  onReset: () => void;
  toast: (msg: string, kind?: 'info' | 'success' | 'error') => void;
}

export function ResultActions({ t, result, reportHtml, onReset, toast }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 hidden text-xs font-semibold uppercase tracking-wide text-muted sm:inline">
          {t('downloads')}
        </span>
        <button
          type="button"
          onClick={() => {
            downloadReportHtml(reportHtml, result.fileLabel);
            toast(t('reportDownloaded'), 'success');
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-leaf px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
        >
          <Download className="h-4 w-4" /> {t('downloadReport')}
        </button>
        <SecondaryButton
          onClick={() => {
            downloadCsv(result);
            toast(t('csvDownloaded'), 'success');
          }}
          icon={<Table2 className="h-4 w-4" />}
          label={t('downloadCsv')}
        />
        <SecondaryButton
          onClick={() => {
            downloadJson(result);
            toast(t('jsonDownloaded'), 'success');
          }}
          icon={<Braces className="h-4 w-4" />}
          label={t('downloadJson')}
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="group inline-flex items-center gap-2.5 rounded-xl border-2 border-brand-500 bg-gradient-to-b from-white to-slate-50 px-5 py-2.5 text-sm font-bold text-brand-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_5px_rgba(14,165,233,0.12),0_6px_16px_-5px_rgba(14,165,233,0.22)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-600 hover:bg-sky-50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_10px_rgba(14,165,233,0.20),0_12px_26px_-6px_rgba(14,165,233,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-[inset_0_2px_5px_rgba(14,165,233,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <RefreshCw className="h-4 w-4 text-brand-600 transition-transform duration-500 ease-out group-hover:-rotate-180 motion-reduce:transition-none motion-reduce:group-hover:rotate-0" />
        {t('analyzeAnother')}
      </button>
    </div>
  );
}

function SecondaryButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-brand-500 hover:text-brand-600"
    >
      {icon} {label}
    </button>
  );
}
