import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

const DISMISS_KEY = 'tl-v1-banner-dismissed';
const DOCS_URL = 'https://github.com/andey0Saikiran/tableau-lineage#features';

export function AnnouncementBar() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: banner just returns next visit */
    }
  };

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="relative z-40 bg-gradient-to-r from-sky-700 to-green-800 text-white"
    >
      <div className="mx-auto flex max-w-[96rem] items-center justify-center gap-2.5 px-10 py-2 text-center text-[13px] font-medium sm:px-12">
        <ShieldCheck className="hidden h-3.5 w-3.5 flex-shrink-0 opacity-90 sm:block" aria-hidden />
        <p className="min-w-0">
          <span className="font-bold">New:</span>{' '}
          <span className="sm:hidden">now finds unused fields and compares versions.</span>
          <span className="hidden sm:inline">
            it now audits your workbook
            <span className="hidden md:inline">: unused fields, duplicate calculations, performance findings</span>
            .<span className="hidden lg:inline"> Plus version comparison.</span>
          </span>{' '}
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap font-semibold underline decoration-white/50 underline-offset-2 transition-colors hover:decoration-white"
          >
            Learn more →
          </a>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
