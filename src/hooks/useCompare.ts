import { useCallback, useState } from 'react';
import type { WorkbookDiff, WorkbookSnapshot } from '../lib/diff';

/** One step in a version chain: what changed between two consecutive files. */
export interface DiffStep {
  before: string;
  after: string;
  diff: WorkbookDiff;
}

/** Comparing more than a handful at once stops being readable, and every file
 *  is parsed in memory, so the queue is capped. */
export const MAX_COMPARE_FILES = 5;

/**
 * Parses a chain of workbook versions and diffs each consecutive pair, entirely
 * in the browser. Two files give one diff; five give four steps, which is how
 * someone reviews a workbook that moved through several revisions.
 */
export function useCompare() {
  const [steps, setSteps] = useState<DiffStep[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = useCallback(async (files: File[]) => {
    if (files.length < 2) {
      setError('Add at least two workbooks to compare.');
      return;
    }
    setBusy(true);
    setError(null);
    setSteps(null);
    try {
      const [{ extractFromTwbx }, filterMod, { extractSqlFromTwbx }, dashMod, { diffWorkbooks }] =
        await Promise.all([
          import('../lib/extractor'),
          import('../lib/filterExtractor'),
          import('../lib/sqlExtractor'),
          import('../lib/dashboardExtractor'),
          import('../lib/diff'),
        ]);

      const snapshot = async (file: File, index: number): Promise<WorkbookSnapshot> => {
        const buffer = await file.arrayBuffer();
        const base = file.name.replace(/\.twbx?$/i, '');
        const result = extractFromTwbx(buffer, file.name);
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
          // Identical filenames are common (the same export downloaded twice),
          // so the position disambiguates them in the output.
          label: `${index + 1}. ${base}`,
          result,
          filters: safe(() => filterMod.extractFiltersFromTwbx(buffer, file.name)),
          sql: safe(() => extractSqlFromTwbx(buffer, file.name)),
          dashboards: safe(() => dashMod.extractDashboardsFromTwbx(buffer, file.name)),
          provenance: safe(() => dashMod.extractProvenanceFromTwbx(buffer, file.name)),
        };
      };

      const snaps = await Promise.all(files.map((f, i) => snapshot(f, i)));
      const out: DiffStep[] = [];
      for (let i = 0; i < snaps.length - 1; i++) {
        out.push({
          before: snaps[i].label,
          after: snaps[i + 1].label,
          diff: diffWorkbooks(snaps[i], snaps[i + 1]),
        });
      }
      setSteps(out);
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
    setSteps(null);
    setError(null);
  }, []);

  return { steps, busy, error, compare, resetCompare };
}
