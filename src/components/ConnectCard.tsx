import { Star, MessageSquare } from 'lucide-react';
import { Linkedin } from './BrandIcons';
import { CREATOR, REPO_URL } from '../lib/site';
import type { AuditResult } from '../lib/audit';

/**
 * The one place the tool asks for anything back.
 *
 * It renders directly under the result actions, not at the foot of the page:
 * below the lineage graph this card sits thousands of pixels down, where a
 * visitor who already got their answer has closed the tab.
 *
 * The headline quotes the reader's own workbook. "Was this useful?" makes them
 * do the work of remembering; a count hands them the reason.
 */
/** "SQL", "SQL and filters", "SQL, filters and dashboards". */
function listOf(items: string[]): string {
  return items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function headline(audit: AuditResult | null, failedSections: string[] = []): string {
  if (!audit) return 'The lineage for this workbook is below.';
  // Any failed section can hide a field's only usage (SQL and filters are
  // reachability roots in the audit), so nothing is "definitely" unused then.
  const incomplete = failedSections.length > 0;
  const n = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

  if (audit.dead.length > 0) {
    // The dead list mixes calculations, columns and parameters, and grades each
    // by confidence. Name what is actually in it, and hedge unless every entry
    // is a definite "unused": the rows below say "Likely unused" otherwise.
    const params = audit.dead.filter((d) => d.kind === 'parameter').length;
    const noun =
      params === 0 ? ['field', 'fields']
        : params === audit.dead.length ? ['parameter', 'parameters']
          : ['field or parameter', 'fields and parameters'];
    const certainty =
      !incomplete && audit.dead.every((d) => d.confidence === 'unused') ? 'unused' : 'likely unused';
    return `Found ${n(audit.dead.length, `${certainty} ${noun[0]}`, `${certainty} ${noun[1]}`)} in this workbook.`;
  }
  if (audit.duplicates.length > 0) {
    // audit.duplicates holds groups, not calculations: count in the same unit
    // the audit panel below uses, so the two numbers always agree.
    return `Found ${n(audit.duplicates.length, 'group of duplicate calculations', 'groups of duplicate calculations')} in this workbook.`;
  }
  if (audit.lint.length > 0) {
    return `Found ${n(audit.lint.length, 'thing', 'things')} worth a look in this workbook.`;
  }
  // Never call a workbook clean when part of the analysis could not run. The
  // audit panel below explains a limited dead-weight check; a failed section
  // renders no panel at all, so the card has to name it itself.
  if (audit.limited) return 'Some checks could not run on this workbook. Details are below.';
  if (incomplete) {
    return `Could not read the ${listOf(failedSections)} in this workbook, so those checks were skipped.`;
  }
  return 'This workbook came back clean.';
}

export function ConnectCard({
  audit,
  failedSections = [],
}: {
  audit: AuditResult | null;
  /** Sections of the analysis that failed to parse (useWorkbook's partialSections). */
  failedSections?: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-white/70 px-5 py-4 shadow-sm backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{headline(audit, failedSections)}</p>
        <p className="text-xs text-muted">
          Free and open source, built by {CREATOR.name}. If it saved you time, a star helps other
          people find it.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-500 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition-colors hover:bg-sky-50"
        >
          <Star className="h-3.5 w-3.5" /> Star on GitHub
        </a>
        <a
          href={CREATOR.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand-500 hover:text-brand-700"
        >
          <Linkedin className="h-3.5 w-3.5" /> Connect on LinkedIn
        </a>
        <a
          href={`${REPO_URL}/issues/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand-500 hover:text-brand-700"
        >
          <MessageSquare className="h-3.5 w-3.5" /> Report an issue
        </a>
      </div>
    </div>
  );
}
