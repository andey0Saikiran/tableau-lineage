import { useCallback, useState } from 'react';
import { extractFromXml, readTwbXml, TableauExtractionError } from '../lib/extractor';
import { extractSqlFromXml } from '../lib/sqlExtractor';
import type { SqlExtractResult } from '../lib/sqlExtractor';
import { extractFiltersFromXml, extractWorksheetsFromXml } from '../lib/filterExtractor';
import type { FilterExtractResult } from '../lib/filterExtractor';
import type { AuditResult } from '../lib/audit';
import type { ExtractResult } from '../lib/types';

// 500 MB: safe because only the .twb XML inside is ever decompressed — the
// bundled data extract (what makes big .twbx files big) is skipped entirely.
const MAX_BYTES = 500 * 1024 * 1024;

type Status = 'idle' | 'parsing' | 'done' | 'error';

export interface WorkbookState {
  status: Status;
  result: ExtractResult | null;
  sql: SqlExtractResult | null;
  filters: FilterExtractResult | null;
  audit: AuditResult | null;
  reportHtml: string | null;
  error: string | null;
  fileName: string | null;
  /** Sections that failed to parse, so the UI can say the view is partial. */
  partialSections: string[];
}

const INITIAL: WorkbookState = {
  status: 'idle',
  result: null,
  sql: null,
  filters: null,
  audit: null,
  reportHtml: null,
  error: null,
  fileName: null,
  partialSections: [],
};

/**
 * Parses a .twbx entirely in the browser. The ArrayBuffer is read locally and
 * never sent anywhere — this hook makes no network requests.
 */
export function useWorkbook() {
  const [state, setState] = useState<WorkbookState>(INITIAL);

  const analyze = useCallback(async (file: File) => {
    if (!/\.twbx?$/i.test(file.name)) {
      setState({ ...INITIAL, status: 'error', error: 'invalidFile' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ ...INITIAL, status: 'error', error: 'fileTooLarge' });
      return;
    }

    setState({ ...INITIAL, status: 'parsing', fileName: file.name });

    // Yield so the parsing state paints before the (synchronous) heavy work.
    // setTimeout rather than requestAnimationFrame: rAF is suspended while the
    // tab is hidden, which would leave the analysis wedged in "Analyzing…" for
    // anyone who drops a file and switches away.
    await new Promise((r) => setTimeout(r, 0));

    try {
      const buffer = await file.arrayBuffer();
      const label = file.name.replace(/\.twbx?$/i, '');

      // Unzip and parse ONCE, then share the parsed document with every
      // extractor. Previously each extractor re-unzipped and re-parsed the same
      // XML (4 unzips, 5 parses) which dominated the cost on large workbooks.
      const xml = /\.twb$/i.test(file.name)
        ? new TextDecoder('utf-8').decode(new Uint8Array(buffer))
        : readTwbXml(buffer);

      const result = extractFromXml(xml, label);

      // The sections below are additive: one failing must never sink the whole
      // analysis, but the user is told the view is partial rather than silently
      // being shown less than the workbook contains.
      const partial: string[] = [];

      let sql: SqlExtractResult | null = null;
      try {
        sql = extractSqlFromXml(xml, label);
      } catch {
        partial.push('SQL');
      }

      let filters: FilterExtractResult | null = null;
      try {
        filters = extractFiltersFromXml(xml, label);
      } catch {
        partial.push('filters');
      }

      try {
        result.worksheets = extractWorksheetsFromXml(xml, label);
      } catch {
        result.worksheets = [];
        partial.push('worksheets');
      }

      // Audit runs on the already-parsed model. Lazy-imported so none of it
      // touches the landing-page bundle.
      let audit: AuditResult | null = null;
      try {
        const { auditWorkbook } = await import('../lib/audit');
        audit = auditWorkbook({ result, filters, sql });
      } catch {
        partial.push('audit');
      }

      // Lazy-load the report builder (it inlines vis-network) so the heavy code
      // stays out of the initial page bundle.
      const { buildReportHtml } = await import('../lib/reportTemplate');
      const reportHtml = buildReportHtml(result);
      setState({
        status: 'done',
        result,
        sql,
        filters,
        audit,
        reportHtml,
        error: null,
        fileName: file.name,
        partialSections: partial,
      });
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
