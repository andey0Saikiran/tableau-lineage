# tableau-lineage-mcp

**Let your AI assistant read the lineage inside Tableau workbooks — without the workbook ever leaving your machine.**

An [MCP](https://modelcontextprotocol.io) server that parses local Tableau workbooks (`.twbx` / `.twb`) and exposes their calculated-field dependencies, formulas, parameters, and full lineage graph as tools for Claude, Cursor, and any other MCP client.

It is the same open-source extraction engine that powers [tableau-lineage.com](https://tableau-lineage.com), wrapped for AI assistants. Parsing happens **in-process on your machine**: no upload, no server, no account. When reading a `.twbx`, only the workbook XML is decompressed — the bundled data extract is never touched.

## What you can ask your assistant

- *"Which fields does `[Profit Ratio]` depend on in `~/Downloads/Sales.twbx`?"*
- *"What breaks if I change `[Revenue Base]`?"* (transitive impact analysis)
- *"List every LOD expression in this workbook with its formula."*
- *"Which calculated fields use the `Date Granularity` parameter?"*
- *"Document all calculations in this workbook as a data dictionary."*

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
| `analyze_workbook` | Overview: stats, datasources, calculated fields by type, parameters, raw fields |
| `list_calculated_fields` | Every calculation with formula, type, and direct dependencies; optional substring filter |
| `get_field` | One field in full detail, including everything that directly uses it |
| `trace_dependencies` | Upstream tree (down to raw columns and parameters) + transitive downstream impact |
| `list_parameters` | Parameters with values, datatypes, allowed values, and which fields use them |
| `get_lineage_graph` | The complete dependency graph as nodes + edges JSON |

All tools take a `path` to a local `.twbx` or `.twb` file. Field names are case-insensitive and brackets are optional: `Profit Ratio` and `[profit ratio]` both resolve.

## Privacy

- The workbook is read from your local disk and parsed in the Node process. **Nothing is sent anywhere.**
- For `.twbx` packages, only `.twb` XML entries are decompressed. The packaged data extract (`.hyper` / `.tde`) is skipped entirely.
- No analytics, no telemetry, no network calls at all.

Because this package is open source, you can verify all of the above in [the code](https://github.com/andey0Saikiran/tableau-lineage/tree/main/mcp).

## Prefer a UI?

The same engine runs as a free web app at **[tableau-lineage.com](https://tableau-lineage.com)** — drag a `.twbx` in and get an interactive lineage graph and searchable data dictionary, 100% in your browser.

## Development

```bash
git clone https://github.com/andey0Saikiran/tableau-lineage
cd tableau-lineage/mcp
npm install
npm test        # builds, then runs an end-to-end JSON-RPC smoke test
```

## License

MIT © [Sai Kiran Andey](https://www.linkedin.com/in/andeysaikiran/)
