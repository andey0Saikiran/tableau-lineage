# Tableau Lineage Visualizer

A privacy-first web app that visualizes the field-level lineage, calculated-field
dependencies, and metadata inside any Tableau workbook (`.twbx`) — **entirely in your
browser**. Drop in a workbook and get an interactive dependency graph and a searchable
data dictionary. Nothing is uploaded, stored, or sent anywhere.

🔗 **Live:** https://tableau-lineage.com

---

## Why

Inheriting or auditing someone else's Tableau workbook means reverse-engineering dozens
of calculated fields and their tangled dependencies by hand. This tool reads the
workbook's structure and maps it for you: every calculated field, its formula, the raw
fields and parameters it depends on, and which calcs are LOD or table calculations.

Because Tableau workbooks often contain sensitive data, the whole thing runs locally —
the `.twbx` never leaves your machine.

## Features

- **Interactive dependency graph** (vis-network): nodes for calculated fields, raw
  fields, and parameters; edges show what depends on what. Cluster by data source,
  search, highlight dependency chains, zoom and pan.
- **Searchable data dictionary**: every calculated field grouped by data source, with
  its formula and dependencies; every parameter with its type, current value, and options.
- **Six metrics at a glance**: data sources, calculated fields, raw fields, parameters,
  LOD calcs, table calcs.
- **Exports**, all generated in-browser:
  - **Interactive HTML** — a self-contained, watermarked report (vis-network inlined, so
    it works offline). The same artifact you see in the app.
  - **CSV** of the field inventory and **JSON** of the full model.
- **Clickable metrics**: click a stat (Calculated Fields, Raw Fields, Parameters, LOD,
  Table Calcs) to highlight those nodes in the graph.
- **Private by architecture**: `.twbx` parsing (unzip + XML) happens client-side. No
  backend, no upload, no cookies. Analytics is an anonymous, aggregate page-view count.
- **Accessible**: keyboard navigation, focus management, AA contrast, reduced-motion
  support, and a text dictionary as an equivalent to the canvas graph.
- **7 UI languages** with English fallback.

## How it works

```
.twbx (a ZIP)
  └─ fflate unzips the .twb entry  ──►  DOMParser reads the XML
        └─ extractor.ts builds the lineage model (calc fields, deps, params, stats)
              ├─ in-app: rendered as a sandboxed <iframe srcdoc> report
              └─ exports: HTML / PNG / CSV / JSON, all from the same model
```

The analytical core (`src/lib/extractor.ts`) is a faithful TypeScript port of the
original Python service's extraction logic, with two correctness fixes:

1. **Parameter references by caption.** Formulas reference parameters by their caption
   (e.g. `[Parameters].[Survival Target (Months)]`), but the parameter's internal name
   can differ (`[Survival Benchmark]`). The original failed to resolve these and leaked a
   phantom `Parameters` dependency. Fixed.
2. **Table-calc detection by token, not substring.** The original flagged a field as a
   table calc because `TOTAL` was a substring of `[total_views]`. Now matched as whole
   function calls (`\bTOTAL\s*(`). LOD detection is brace-anchored.

Both fixes are covered by `npm run test:core` (real-workbook fixtures + a synthetic
LOD/table-calc case).

## Tech stack

Vite · React 19 · TypeScript · Tailwind CSS · [fflate](https://github.com/101arrowz/fflate)
(unzip) · native DOMParser (XML) · [vis-network](https://visjs.github.io/vis-network/)
(graph). No backend.

## MCP server (for AI assistants)

The same extraction engine ships as an MCP server, so Claude, Cursor, and other MCP
clients can read calculated-field dependencies, formulas, and parameters straight from a
workbook on your disk — still 100% local, nothing uploaded.

```bash
claude mcp add tableau-lineage -- npx -y tableau-lineage-mcp
```

Tools: `analyze_workbook`, `list_calculated_fields`, `get_field`, `trace_dependencies`,
`list_parameters`, `get_lineage_graph`. Full docs in [`mcp/`](mcp/).

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # typecheck + production build to dist/
npm run preview      # serve the production build
npm run typecheck    # tsc --noEmit
npm run test:core    # extractor parity + regression tests (Node)
```

## Deploy (Cloudflare Pages)

This is a static site — deploy the `dist/` folder to any static host. Recommended:
**Cloudflare Pages** (unlimited bandwidth, global CDN, native apex-domain TLS).

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → select
   the repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Every push to `main` now builds and deploys automatically. (`.github/workflows/ci.yml`
   runs the typecheck/tests/build as a quality gate; Cloudflare handles the deploy.)
5. **Custom domain:** Pages project → Custom domains → add `tableau-lineage.com` and
   `www`. Moving the domain's nameservers to Cloudflare gives automatic HTTPS and
   apex-domain handling.

`public/_headers` ships a security baseline and a Content-Security-Policy that restricts
outbound connections to this origin and Cloudflare's analytics only — which is what makes
the "your data never leaves your browser" promise enforceable.

## Analytics (cookieless)

Visitor counts come from **Cloudflare Web Analytics** — cookieless, no personal data.

1. Cloudflare dashboard → **Web Analytics → Add a site** → enter the hostname.
2. Copy the beacon token and paste it into the commented `<script>` in `index.html`.
3. View numbers in the Cloudflare dashboard → Web Analytics.

That single page-view beacon is the only data collected.

## Demo workbook

`public/demo.twbx` powers the "try a sample workbook" button. Replace it with any `.twbx`
you'd like to feature as the default example.

## License

[MIT](LICENSE) © 2026 Sai Kiran Andey

Built by **Sai Kiran Andey**.
