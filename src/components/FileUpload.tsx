import { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, X, ShieldCheck, Sparkles, PlayCircle, Loader2 } from 'lucide-react';
import type { TranslationKey } from '../lib/i18n';

interface Props {
  t: (k: TranslationKey) => string;
  status: 'idle' | 'parsing' | 'done' | 'error';
  error: string | null;
  onAnalyze: (file: File) => void;
  onClearError: () => void;
  onTryDemo: () => void;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ t, status, error, onAnalyze, onClearError, onTryDemo }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsing = status === 'parsing';

  const pick = useCallback(
    (f: File | undefined | null) => {
      if (!f) return;
      onClearError();
      setFile(f);
    },
    [onClearError],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      pick(e.dataTransfer.files?.[0]);
    },
    [pick],
  );

  return (
    <div className="animate-scale-in">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-3xl border bg-white/70 p-8 text-center shadow-[0_24px_60px_-24px_rgba(15,23,42,0.25)] backdrop-blur transition-all sm:p-12 ${
          dragging ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-dashed border-slate-300'
        }`}
      >
        <div
          className={`mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-leaf text-white shadow-lg ${dragging ? 'animate-glow' : ''}`}
          aria-hidden
        >
          <UploadCloud className="h-7 w-7" />
        </div>

        <h2 className="text-xl font-bold text-ink sm:text-2xl">
          {dragging ? t('dropHere') : t('uploadTitle')}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t('uploadDescription')}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-brand-500 hover:text-brand-600 focus-within:border-brand-500">
            <FileText className="h-4 w-4" />
            {t('chooseFile')}
            <input
              ref={inputRef}
              type="file"
              accept=".twbx"
              aria-label="Choose a .twbx Tableau workbook file"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>

          <button
            type="button"
            disabled={!file || parsing}
            onClick={() => file && onAnalyze(file)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-leaf px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t('analyzing')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> {t('analyzeWorkbook')}
              </>
            )}
          </button>
        </div>

        {file && (
          <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-2">
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-sm text-ink">
              <FileText className="h-4 w-4 flex-shrink-0 text-brand-500" />
              <span className="truncate">{file.name}</span>
              <span className="flex-shrink-0 text-xs text-muted">{humanSize(file.size)}</span>
              {!parsing && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    onClearError();
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                  aria-label="Remove selected file"
                  className="flex-shrink-0 rounded-full p-0.5 text-muted hover:bg-slate-100 hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-leaf" />
            {t('privacyInline')}
          </p>
          {!file && (
            <button
              type="button"
              disabled={parsing}
              onClick={onTryDemo}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 underline-offset-2 hover:underline disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" /> See it with a sample workbook
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{t(error as TranslationKey)}</span>
          <button
            type="button"
            onClick={onClearError}
            className="rounded-md px-2 py-1 font-semibold text-red-700 hover:bg-red-100"
          >
            {t('tryAgain')}
          </button>
        </div>
      )}
    </div>
  );
}
