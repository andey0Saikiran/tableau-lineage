# tableau-lineage-mcp

**Let your AI assistant read the lineage inside Tableau workbooks without the workbook ever leaving your machine.**

An [MCP](https://modelcontextprotocol.io) server that parses local Tableau workbooks (`.twbx` / `.twb`) and exposes eleven tools to Claude, Cursor and any other MCP client: a full workbook audit (unused fields, duplicate calculations, performance findings), a semantic diff between two versions, and the complete lineage of every calculated field, parameter, filter, worksheet, dashboard and stored SQL statement.

It is the same open-source extraction engine that powers [tableau-lineage.com](https://tableau-lineage.com), wrapped for AI assistants. Parsing happens **in-process on your machine**: no upload, no server, no account. When reading a `.twbx`, only the workbook XML is decompressed; the bundled data extract is never touched.

## What you can ask your assistant

- *"Audit `~/Downloads/Sales.twbx`. What is safe to delete?"*
- *"What changed between v3 and v4 of this dashboard, and what does it break?"*
- *"Which fields does `[Profit Ratio]` depend on?"*
- *"Why is this workbook slow?"*
- *"Which sheets filter on Region, and what values are selected?"*
- *"Write a data dictionary for this workbook."*

## Install

### Claude Code

```bash
claude mcp add tableau-lineage -- npx -y tableau-lineage-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "tableau-lineage": {
      "command": "npx",
      "args": ["-y", "tableau-lineage-mcp"]
    }
  }
}
```

### Cursor / other MCP clients

Any client that supports stdio MCP servers works with the same command: `npx -y tableau-lineage-mcp`.

Requires Node.js 18+.

## Tools

| Tool | What it does |
| --- | --- |
| `audit_workbook` | Unused fields and parameters (graded by confidence, with reasons), duplicate calculations, and performance findings with severities and fixes |
| `diff_workbooks` | Semantic diff of two versions: calculations added, removed, renamed or edited (each edit with the downstream fields it affects), plus parameters, filters, sheets, dashboards, data sources and SQL |
| `analyze_workbook` | Overview: stats, data sources, calculated fields by type, parameters, raw fields |
| `list_calculated_fields` | Every calculation with formula, type, and direct dependencies; optional substring filter |
| `get_field` | One field in full detail, including everything that directly uses it |
| `trace_dependencies` | Upstream tree (down to raw columns and parameters) plus transitive downstream impact |
| `list_parameters` | Parameters with values, datatypes, allowed values, and which fields use them |
| `get_lineage_graph` | The complete dependency graph as nodes and edges JSON |
| `list_sql_queries` | Custom SQL (full query text), Initial SQL, stored-procedure references with parameters, and `RAWSQL_*` calculations, each with the connection it targets |
| `list_filters` | Every filter, deduplicated across worksheets: field, kind, context-filter status, member selections and ranges, plus a `by_worksheet` breakdown |
| `list_worksheets` | Every worksheet with the fields it uses (caption-resolved) and the filters it applies |

All tools take a `path` to a local `.twbx` or `.twb` file. Field names are case-insensitive and brackets are optional: `Profit Ratio` and `[profit ratio]` both resolve.

## Privacy Policy

Full policy: https://github.com/andey0Saikiran/tableau-lineage/blob/main/PRIVACY.md

**What is collected: nothing.** This server makes no network requests of any kind. It
reads only the workbook paths you explicitly pass to it, parses them in memory on your
machine, and returns the results to the MCP client that started it. It does not read your
other files, your conversation history, or your assistant's memory, and it writes nothing
to disk.

**Storage and retention:** none. Workbook data lives in memory for the length of the call
and is discarded when the process exits. There is no server, no database and no logging.

**Third parties:** none. Note that the *results* of a tool call (field names, formulas,
audit findings) are returned to the AI assistant you chose to ask, so that it can answer
you; your workbook file itself is never sent anywhere. Your assistant's own privacy policy
governs that conversation.

**Contact:** https://github.com/andey0Saikiran/tableau-lineage/issues ·
security reports: https://github.com/andey0Saikiran/tableau-lineage/security/advisories/new

## How it works

- The workbook is read from your local disk and parsed in the Node process. **Nothing is sent anywhere.**
- Unused fields are reported as *candidates* with a confidence level, never as a
  guaranteed-safe delete list: a workbook file cannot prove a field is unreferenced
  everywhere. Read the reason before deleting anything.
- For `.twbx` packages, only `.twb` XML entries are decompressed. The packaged data extract (`.hyper` / `.tde`) is skipped entirely.
- No analytics, no telemetry, no network calls at all.

Because this package is open source, you can verify all of the above in [the code](https://github.com/andey0Saikiran/tableau-lineage/tree/main/mcp).

## Prefer a UI?

The same engine runs as a free web app at **[tableau-lineage.com](https://tableau-lineage.com)**: drag a `.twbx` in and get the audit, an interactive lineage graph, a searchable data dictionary, and a version comparison, 100% in your browser.

## Development

```bash
git clone https://github.com/andey0Saikiran/tableau-lineage
cd tableau-lineage/mcp
npm install
npm test        # builds, then runs an end-to-end JSON-RPC smoke test
```

## License

MIT © [Sai Kiran Andey](https://www.linkedin.com/in/andeysaikiran/)
