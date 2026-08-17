// Build-time pre-render.
//
// The app is a client-rendered SPA, so before this step `dist/index.html`
// shipped an empty <div id="root"></div>: zero characters of body text and no
// <h1>. Google executes JavaScript on a slower second pass, and Bing,
// DuckDuckGo and most AI crawlers largely do not, so every piece of on-page
// SEO copy was invisible to them.
//
// This renders the real landing components to static HTML and injects them into
// the built index.html. It stays 100% static: no server, no runtime cost. React
// replaces the markup when it mounts, so there is one source of truth for the
// copy (the components themselves) rather than a hand-maintained HTML twin.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');
const tmpEntry = path.join(dist, '.prerender-entry.mjs');

const ENTRY_SOURCE = `
import { renderToStaticMarkup } from 'react-dom/server';
import { LandingCopy } from '../src/components/LandingCopy';
import { SeoContent } from '../src/components/SeoContent';

export function render() {
  return renderToStaticMarkup(
    <div className="relative flex min-h-screen flex-col">
      <main className="relative z-10 flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-8 lg:min-h-[calc(100vh-65px)] lg:grid-cols-2 lg:gap-14 lg:py-0">
          <LandingCopy />
        </section>
        <SeoContent />
      </main>
    </div>,
  );
}
`;

const entrySrcPath = path.join(dist, '.prerender-entry.jsx');

async function main() {
  if (!fs.existsSync(indexPath)) {
    console.error('prerender: dist/index.html not found. Run the Vite build first.');
    process.exit(1);
  }

  fs.writeFileSync(entrySrcPath, ENTRY_SOURCE);

  // Bundle the entry (and the components it pulls in) for Node.
  await build({
    entryPoints: [entrySrcPath],
    outfile: tmpEntry,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    // React and lucide resolve from node_modules at run time (bundling lucide
    // pulls in its CommonJS build, which does not load from an ESM output).
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server', 'lucide-react'],
    logLevel: 'silent',
  });

  const { render } = await import(`file://${tmpEntry}?t=${Date.now()}`);
  const markup = render();

  let html = fs.readFileSync(indexPath, 'utf8');
  const rootDiv = '<div id="root"></div>';
  if (!html.includes(rootDiv)) {
    console.error('prerender: could not find an empty <div id="root"> to fill.');
    process.exit(1);
  }
  html = html.replace(rootDiv, `<div id="root">${markup}</div>`);
  fs.writeFileSync(indexPath, html);

  fs.rmSync(entrySrcPath, { force: true });
  fs.rmSync(tmpEntry, { force: true });

  // Report what a crawler will now actually see.
  const bodyText = markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const h1 = (markup.match(/<h1[^>]*>(.*?)<\/h1>/s) || [])[1]?.replace(/<[^>]*>/g, '') ?? '(none)';
  console.log(
    `prerender: ${bodyText.length} characters of crawlable text, ${(markup.match(/<h1/g) || []).length} <h1>, ` +
      `${(markup.match(/<h2/g) || []).length} <h2>, ${(markup.match(/<h3/g) || []).length} <h3>`,
  );
  console.log(`prerender: h1 = "${h1}"`);
}

main().catch((err) => {
  console.error('prerender failed:', err);
  process.exit(1);
});
