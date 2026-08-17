import { Star, MessageSquare } from 'lucide-react';
import { Linkedin } from './BrandIcons';
import { CREATOR, REPO_URL } from '../lib/site';

/**
 * Shown once the analysis succeeds, which is the only moment the visitor has
 * actually received value. Everything else about the author lives in the header
 * and footer, where a task-focused user never looks.
 */
export function ConnectCard() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-white/70 px-5 py-4 shadow-sm backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">Was this useful?</p>
        <p className="text-xs text-muted">
          Built by {CREATOR.name}, free and open source. Feedback and bug reports are genuinely
          welcome.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={CREATOR.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-500 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition-colors hover:bg-sky-50"
        >
          <Linkedin className="h-3.5 w-3.5" /> Connect on LinkedIn
        </a>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand-500 hover:text-brand-600"
        >
          <Star className="h-3.5 w-3.5" /> Star on GitHub
        </a>
        <a
          href={`${REPO_URL}/issues/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand-500 hover:text-brand-600"
        >
          <MessageSquare className="h-3.5 w-3.5" /> Report an issue
        </a>
      </div>
    </div>
  );
}
