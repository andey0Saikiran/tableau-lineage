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
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-muted shadow-sm transition-colors hover:border-brand-500 hover:text-brand-600"
      >
        <RefreshCw className="h-4 w-4" /> {t('analyzeAnother')}
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
