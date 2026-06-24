import { Info, ShieldCheck } from 'lucide-react';
import { Github } from './BrandIcons';
import { Logo } from './Logo';
import { LanguageSelector } from './LanguageSelector';
import { REPO_URL } from '../lib/site';
import type { Language, TranslationKey } from '../lib/i18n';

interface Props {
  t: (k: TranslationKey) => string;
  language: Language;
  onLanguage: (l: Language) => void;
  onAbout: () => void;
  onPrivacy: () => void;
}

export function Header({ t, language, onLanguage, onAbout, onPrivacy }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="/" className="flex min-w-0 animate-slide-in-left items-center gap-3" aria-label={t('title')}>
          <Logo size={36} className="flex-shrink-0 drop-shadow-sm" />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold leading-tight text-ink">
              {t('title')}
            </span>
            <span className="hidden truncate text-xs text-muted sm:block">{t('subtitle')}</span>
          </span>
        </a>

        <nav className="flex animate-slide-in-right items-center gap-1.5 sm:gap-2" aria-label="Primary">
          <button
            type="button"
            onClick={onAbout}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-brand-50 hover:text-brand-600 sm:inline-flex"
          >
            <Info className="h-4 w-4" /> {t('aboutTitle')}
          </button>
          <button
            type="button"
            onClick={onPrivacy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-brand-50 hover:text-brand-600"
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">{t('privacyTitle')}</span>
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-brand-50 hover:text-brand-600"
          >
            <Github className="h-[18px] w-[18px]" />
          </a>
          <LanguageSelector value={language} onChange={onLanguage} />
        </nav>
      </div>
    </header>
  );
}
