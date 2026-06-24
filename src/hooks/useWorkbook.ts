import { useCallback, useState } from 'react';
import { extractFromTwbx, TableauExtractionError } from '../lib/extractor';
import type { ExtractResult } from '../lib/types';

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB, enforced client-side

type Status = 'idle' | 'parsing' | 'done' | 'error';

export interface WorkbookState {
  status: Status;
  result: ExtractResult | null;
  reportHtml: string | null;
  error: string | null;
  fileName: string | null;
}

const INITIAL: WorkbookState = {
  status: 'idle',
  result: null,
  reportHtml: null,
  error: null,
  fileName: null,
};

/**
 * Parses a .twbx entirely in the browser. The ArrayBuffer is read locally and
 * never sent anywhere — this hook makes no network requests.
 */
export function useWorkbook() {
  const [state, setState] = useState<WorkbookState>(INITIAL);

  const analyze = useCallback(async (file: File) => {
    if (!/\.twbx$/i.test(file.name)) {
      setState({ ...INITIAL, status: 'error', error: 'invalidFile' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ ...INITIAL, status: 'error', error: 'fileTooLarge' });
      return;
    }

    setState({ ...INITIAL, status: 'parsing', fileName: file.name });

    // Yield a frame so the parsing state paints before the (sync) heavy work.
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    try {
      const buffer = await file.arrayBuffer();
      const result = extractFromTwbx(buffer, file.name);
      // Lazy-load the report builder (it inlines vis-network) so the heavy code
      // stays out of the initial page bundle.
      const { buildReportHtml } = await import('../lib/reportTemplate');
      const reportHtml = buildReportHtml(result);
      setState({ status: 'done', result, reportHtml, error: null, fileName: file.name });
    } catch (err) {
      const message =
        err instanceof TableauExtractionError && /no calculated fields/i.test(err.message)
          ? 'noCalcFields'
          : 'processingError';
      setState({ ...INITIAL, status: 'error', error: message, fileName: file.name });
    }
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);
  const clearError = useCallback(
    () => setState((s) => (s.status === 'error' ? INITIAL : s)),
    [],
  );

  return { ...state, analyze, reset, clearError };
}
