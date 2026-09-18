# Tableau Workbook Auditor

Find what is wrong with any Tableau workbook (`.twbx`), and map every dependency inside
it, **entirely in your browser**. Unused fields, duplicate calculations, performance
problems, full calculated-field lineage, filters, dashboards and stored SQL. Nothing is
uploaded, stored, or sent anywhere.

🔗 **Live:** https://tableau-lineage.com
📦 **MCP server:** [`tableau-lineage-mcp`](https://www.npmjs.com/package/tableau-lineage-mcp)

---

## Why

Inheriting someone else's Tableau workbook means reverse-engineering dozens of
calculated fields by hand to answer one question: where does this number come from, and
what breaks if I change it?

Two more questions come up just as often:

- **What in here is dead?** Tableau's Workbook Optimizer flags unused fields, but only from
  inside Tableau: the Server menu or publishing dialog in Desktop, or the publishing menu or
  publishing dialog in web authoring on Server or Cloud.
- **Why is it slow?** Tableau's answers are that same Optimizer, which checks best-practice
  guidelines, and Performance Recording, which shows where the time goes. Both run only
  inside Tableau, and Tableau Catalog, which maps lineage, needs Data Management on Server or
  Cloud.

This reads the workbook file itself: it answers the first two questions and flags the likely
causes of the third, free, with no Tableau install, no licence and no account. Because workbooks often carry sensitive data, everything runs locally: the
`.twbx` never leaves your machine, which is a property of the architecture rather than a
promise (there is no server to send it to).

## Features

### Audit

- **Dead weight**: every field, parameter and calculation nothing uses, graded by
  confidence (`unused`, `likely-unused`, `referenced-in-comment`) with the reason spelled
  out. Reported as candidates rather than certainties, because a workbook file cannot
  prove a field is unreferenced everywhere.
- **Duplicate calculations**: identical formulas under different names, and the more
  dangerous case of the same name carrying different formulas.
- **Performance lint**: 15 static rules over what the file actually contains. Heavy and
  nested LODs, long calculations, string-heavy work, too many quick filters, missing
  context filters, live connections, non-fixed dashboard sizing, dense dashboards,
  orphan worksheets.

### Lineage

- **Interactive dependency graph** (vis-network): calculated fields, raw fields,
  parameters and worksheets as nodes; edges show what feeds what. Cluster by data source,
  search, highlight chains, zoom and pan.
- **Searchable data dictionary**: every formula grouped by data source, plus a worksheets
  section.
- **Seven clickable metrics**: data sources, calculated fields, raw fields, parameters,
  LOD calcs, table calcs, filters.

### Structure

- **Filters, decoded**: every filter deduplicated across worksheets, with its kind
  (categorical / quantitative / relative-date), context-filter status, stored member
  selections and ranges, and a per-worksheet breakdown. Data-source filters are called out
  separately.
- **Dashboards**: which worksheets each dashboard places, its fixed size and device
  layouts, plus sheets that sit on no dashboard and sheets that are hidden.
- **Data provenance**: extract or live, connection class / database / server, published
  (`sqlproxy`) sources, and refresh history where the workbook records it.
- **Stored SQL**: every Custom SQL query (full text), Initial SQL statement,
  stored-procedure reference with parameters, and `RAWSQL_*` calculation, each mapped to
  the connection it targets. Runtime-generated live-connection queries are not stored in
  workbook files, so they are explicitly out of scope.

### Compare versions

Drop in up to five versions of the same dashboard and get a **semantic diff**: which
calculations were added, removed, renamed or edited, and for every edit the downstream
fields it can break, plus changed parameters, filters, worksheets, dashboards, data
sources and SQL. Reformatting a calculation is not reported as a change, and a field that
disappears while an identical formula appears under a new name is reported as a rename.

A git diff of two `.twbx` files cannot do this: the workbook is one large XML blob where
layout coordinates and regenerated ids swamp the handful of real changes.

### Exports

All generated in-browser, from the same parsed model:

- **Interactive HTML report**: self-contained and offline-ready (vis-network inlined),
  watermarked with the tool and the author.
- **Markdown handover document**: the workbook written up (metrics, audit, dashboards,
  data sources, parameters, filters, every formula, stored SQL) for a ticket, a wiki or a
  README. Also the format an LLM reads best when someone asks about the workbook later.
- **CSV** field inventory (including which worksheets use each field) and **JSON** of the
  complete model, audit included.

### Everything else

- **Private by architecture**: `.twbx` parsing (unzip + XML) happens client-side. No
  backend, no upload, no cookies. Analytics is an anonymous, aggregate page-view count.
- **Workbooks up to 500 MB**: only the workbook XML is decompressed; the packaged data
  extract is never touched.
- **Accessible**: keyboard navigation, focus management, AA contrast, reduced-motion
  support, and a text dictionary as an equivalent to the canvas graph.
- **Seven UI languages** for the core interface strings (buttons, labels, status
  messages), with English fallback. Longer explanatory copy is English only.

## How it works

```
.twbx (a ZIP)
  └─ fflate unzips ONLY the .twb entry  ──►  DOMParser reads the XML once
        ├─ extractor.ts        lineage model: calcs, dependencies, params, stats
        ├─ filterExtractor.ts  filters + per-worksheet usage
        ├─ sqlExtractor.ts     Custom SQL, Initial SQL, stored procs, RAWSQL
        ├─ dashboardExtractor  dashboards, hidden/orphan sheets, provenance
        ├─ audit.ts            dead weight, duplicates, performance lint
        └─ diff.ts             semantic diff between two parsed workbooks
              ├─ in-app: a sandboxed <iframe srcdoc> report
              └─ exports: HTML / Markdown / CSV / JSON, all from the same model
```

The packaged data extract inside a `.twbx` is never decompressed, which is why a 500 MB
workbook is fine and why the tool cannot see your rows even in principle.

### Correctness notes

The analytical core is a TypeScript port of the original Python service, with fixes that
each exist because the naive version was wrong on a real workbook:

1. **Parameter references by caption.** Formulas reference parameters by caption
   (`[Parameters].[Survival Target (Months)]`) while the internal name differs
   (`[Survival Benchmark]`). The original leaked a phantom `Parameters` dependency.
2. **Table-calc detection by token, not substring.** `TOTAL` inside `[total_views]` was
   flagging ordinary fields as table calcs. Now matched as whole function calls; LOD
   detection is brace-anchored.
3. **Comments and string literals are stripped before dependency scanning.** A field name
   mentioned in a `//` comment is not a dependency, and treating it as one made unused
   fields look used.
4. **Nodes are keyed by data source, not name alone.** Two data sources can both define
   `[Sales]`; merging them fused unrelated lineage into one node.
5. **Captions resolve document-wide.** Workbooks built on published data sources keep
   captions only in the worksheet dependency stubs, so filters and worksheet fields
   surfaced raw keys like `Calculation_5431234567890123`.
6. **A `<datasources>` block is only real at the workbook root.** Every worksheet carries
   a reference list of the same shape, which counted one data source thirteen times on a
   twelve-sheet workbook.

All are covered by tests (`npm test`, `npm run test:core`).

## Tech stack

Vite · React 19 · TypeScript · Tailwind CSS · [fflate](https://github.com/101arrowz/fflate)
(unzip) · native DOMParser (XML) · [vis-network](https://visjs.github.io/vis-network/)
(graph). No backend.

## MCP server (for AI assistants)

The same engine ships as an MCP server, so Claude, Cursor and other MCP clients can read
and audit workbooks straight from your disk. Still 100% local, nothing uploaded.

**Claude Desktop:** [download the extension](https://github.com/andey0Saikiran/tableau-lineage/releases/latest/download/tableau-lineage.mcpb)
and double-click it. One click, no terminal and no Node setup.

**Claude Code** (installs the MCP plus a skill that knows when to use it):

```
/plugin marketplace add andey0Saikiran/tableau-lineage
/plugin install tableau-lineage@tableau-lineage
```

**Cursor and other MCP clients:**

```bash
claude mcp add tableau-lineage -- npx -y tableau-lineage-mcp
```

Eleven tools: `analyze_workbook`, `audit_workbook`, `diff_workbooks`,
`list_calculated_fields`, `get_field`, `trace_dependencies`, `list_parameters`,
`get_lineage_graph`, `list_sql_queries`, `list_filters`, `list_worksheets`. Full docs in
[`mcp/`](mcp/).

Things worth asking it:

- "Audit this workbook and tell me what is safe to delete."
- "What changed between these two versions, and what does it break?"
- "Which sheets filter on Region, and what values are selected?"
- "Write a data dictionary for this workbook."

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # typecheck + production build + pre-render to dist/
npm run preview      # serve the production build
npm run typecheck    # tsc --noEmit
npm test             # Vitest: extractors, audit, diff, exports
npm run test:core    # extractor parity + regression tests (Node)
npm run prerender    # re-run the static pre-render over an existing dist/
```

The build pre-renders the landing page with `react-dom/server` and injects the markup
into `dist/index.html`, so crawlers get real content instead of an empty `<div id="root">`.
It stays a fully static site: there is no server at build time or run time.

## Deploy (Cloudflare Workers static assets)

This is a static site; the `dist/` folder can go on any static host. The live site runs on
**Cloudflare Workers static assets**, configured by `wrangler.jsonc` in this repo:

```jsonc
{ "name": "tableau-lineage", "assets": { "directory": "./dist" } }
```

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → select the
   repo. Cloudflare reads `wrangler.jsonc` and serves `dist/` as static assets.
3. Build settings:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
4. Every push to `main` builds and deploys automatically.
5. **Custom domain:** the Worker → Settings → Domains & Routes → add `tableau-lineage.com`
   (leave the subdomain field blank for the apex). `www` is a proxied CNAME to the apex
   plus a redirect rule. Moving the domain's nameservers to Cloudflare gives automatic
   HTTPS.

Note: this is Workers, not Pages. A Pages project built from the same repo would deploy a
second, parallel copy of the site.

`public/_headers` ships a security baseline and a Content-Security-Policy that restricts
outbound connections to this origin and Cloudflare's analytics only, which is what makes
the "your data never leaves your browser" promise enforceable.

## Analytics (cookieless)

Visitor counts come from **Cloudflare Web Analytics**: cookieless, no personal data.

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
