import { FileUp, Cpu, Share2 } from 'lucide-react';
import { HeroGraph } from './HeroGraph';
import { CREATOR, REPO_URL } from '../lib/site';

/**
 * The landing page's above-the-fold copy, kept as a standalone pure component
 * so the build-time pre-render can emit exactly what the app renders. Without
 * that, crawlers received an empty <div id="root"> and none of this text.
 *
 * No hooks, no browser APIs: it has to run in Node during the pre-render.
 */
export function LandingCopy() {
  return (
    <div className="order-2 lg:order-1">
      <h1 className="text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-[2.85rem] lg:leading-[1.06]">
        Audit any Tableau workbook, free and in your browser
      </h1>
      <p className="mt-4 max-w-lg text-pretty text-[15px] leading-relaxed text-muted">
        Find unused fields, duplicate calculations, and performance problems inside any{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-ink">.twbx</code>, alongside
        a full lineage graph of every calculated field, parameter, filter, and dashboard. Nothing is
        uploaded.
      </p>

      <HeroGraph className="mt-6 max-w-xs animate-fade-in" />

      <ol className="mt-7 space-y-3">
        {[
          { Icon: FileUp, title: 'Drop a .twbx', body: 'Any Tableau packaged workbook, up to 500 MB.' },
          { Icon: Cpu, title: 'Parsed in your browser', body: 'Read locally. It never leaves your machine.' },
          { Icon: Share2, title: 'Audit and explore', body: 'Dead weight, lineage, SQL, then export a report.' },
        ].map(({ Icon, title, body }, i) => (
          <li key={title} className="flex items-center gap-3">
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-leaf text-white">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-sm">
              <b className="text-ink">
                {i + 1}. {title}
              </b>
              <span className="text-muted">: {body}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* Author credit in the landing copy itself. The header's credit is
          hidden below md, so on phones this and the footer are the only ones
          (on phones this sits below the upload card, about two screens down). */}
      <p className="mt-7 text-xs text-muted">
        Built by{' '}
        <a
          href={CREATOR.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ink underline decoration-brand-400/50 underline-offset-2 hover:text-brand-700"
        >
          {CREATOR.name}
        </a>
        . Free and open source:{' '}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ink underline decoration-brand-400/50 underline-offset-2 hover:text-brand-700"
        >
          read the code on GitHub
        </a>
        .
      </p>
    </div>
  );
}
