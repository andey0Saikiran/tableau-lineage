import { useCallback, useState } from 'react';
import type { WorkbookDiff, WorkbookSnapshot } from '../lib/diff';

/**
 * Parses two workbooks and diffs them, entirely in the browser like everything
 * else. The diff engine and both extractors are lazy-imported so Compare costs
 * the landing page nothing.
 */
export function useCompare() {
  const [diff, setDiff] = useState<WorkbookDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = useCallback(async (beforeFile: File, afterFile: File) => {
    setBusy(true);
    setError(null);
    setDiff(null);
    try {
      const [{ extractFromTwbx }, filterMod, { extractSqlFromTwbx }, dashMod, { diffWorkbooks }] =
        await Promise.all([
          import('../lib/extractor'),
          import('../lib/filterExtractor'),
          import('../lib/sqlExtractor'),
          import('../lib/dashboardExtractor'),
          import('../lib/diff'),
        ]);

      const snapshot = async (file: File): Promise<WorkbookSnapshot> => {
        const buffer = await file.arrayBuffer();
        const label = file.name.replace(/\.twbx?$/i, '');
        const result = extractFromTwbx(buffer, file.name);
        // Each extra extractor is optional: a workbook missing dashboards or SQL
        // should still diff on everything else.
        try {
          result.worksheets = filterMod.extractWorksheetsFromTwbx(buffer, file.name);
        } catch {
          result.worksheets = [];
        }
        const safe = <T,>(fn: () => T): T | null => {
          try {
            return fn();
          } catch {
            return null;
          }
        };
        return {
          label,
          result,
          filters: safe(() => filterMod.extractFiltersFromTwbx(buffer, file.name)),
          sql: safe(() => extractSqlFromTwbx(buffer, file.name)),
          dashboards: safe(() => dashMod.extractDashboardsFromTwbx(buffer, file.name)),
          provenance: safe(() => dashMod.extractProvenanceFromTwbx(buffer, file.name)),
        };
      };

      const [b, a] = await Promise.all([snapshot(beforeFile), snapshot(afterFile)]);
      setDiff(diffWorkbooks(b, a));
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? `Could not compare these workbooks: ${err.message}`
          : 'Could not compare these workbooks.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const resetCompare = useCallback(() => {
    setDiff(null);
    setError(null);
  }, []);

  return { diff, busy, error, compare, resetCompare };
}
