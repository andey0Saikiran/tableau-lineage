# Tableau Lineage — Claude Code plugin

Audit and trace Tableau workbooks (`.twbx` / `.twb`) without leaving Claude Code.

## Install

```
/plugin marketplace add andey0Saikiran/tableau-lineage
/plugin install tableau-lineage@tableau-lineage
```

## What you can ask

- *"Audit ~/Downloads/Sales.twbx. What is safe to delete?"*
- *"What breaks if I change [Profit Ratio]?"*
- *"What changed between v3 and v4 of this dashboard?"*
- *"Why is this workbook slow?"*
- *"Which sheets filter on Region?"*

Eleven read-only tools: audit, lineage tracing, diff, calculated fields, parameters,
filters, worksheets, dashboards, data sources, stored SQL, and the full dependency graph.

## Privacy

The workbook is parsed on your machine by a local stdio server
([`tableau-lineage-mcp`](https://www.npmjs.com/package/tableau-lineage-mcp)), which makes
no network calls. Nothing is uploaded. See
[PRIVACY.md](https://github.com/andey0Saikiran/tableau-lineage/blob/main/PRIVACY.md).

## Also available as

- A free web app: [tableau-lineage.com](https://tableau-lineage.com)
- A [Claude Desktop extension](https://github.com/andey0Saikiran/tableau-lineage/releases/latest/download/tableau-lineage.mcpb) (one click, no terminal)

MIT © [Sai Kiran Andey](https://www.linkedin.com/in/andeysaikiran/)
