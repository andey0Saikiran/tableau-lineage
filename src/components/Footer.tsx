import { ShieldCheck } from 'lucide-react';
import { Github, Linkedin } from './BrandIcons';
import { CREATOR, CONTRIBUTORS, REPO_URL, type Person } from '../lib/site';
import type { TranslationKey } from '../lib/i18n';

function PersonLinks({ person }: { person: Person }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold text-ink">{person.name}</span>
      {person.linkedin && (
        <a
          href={person.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${person.name} on LinkedIn`}
          className="text-muted transition-colors hover:text-brand-600"
        >
          <Linkedin className="h-4 w-4" />
        </a>
      )}
      {person.github && (
        <a
          href={person.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${person.name} on GitHub`}
          className="text-muted transition-colors hover:text-brand-600"
        >
          <Github className="h-4 w-4" />
        </a>
      )}
    </span>
  );
}

export function Footer({ t }: { t: (k: TranslationKey) => string }) {
  return (
    <footer className="relative z-10 mt-16 border-t border-border/70 bg-white/50">
      <div className="mx-auto max-w-[96rem] px-6 py-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-leaf" />
            {t('privacyInline')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-sm text-muted">
            <span>{t('madeBy')}</span>
            <PersonLinks person={CREATOR} />
            {CONTRIBUTORS.length > 0 && (
              <>
                <span>{t('contributors')}</span>
                {CONTRIBUTORS.map((c) => (
                  <PersonLinks key={c.name} person={c} />
                ))}
              </>
            )}
          </div>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-brand-600"
          >
            <Github className="h-4 w-4" /> Open source on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
