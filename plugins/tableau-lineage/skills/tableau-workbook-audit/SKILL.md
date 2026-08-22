---
name: tableau-workbook-audit
description: Use when the user mentions a .twbx or .twb file, a Tableau workbook or dashboard, or asks what a calculated field depends on, what would break if a field changed, which fields are unused or duplicated, why a workbook is slow, what SQL a workbook runs, or how two versions of a workbook differ.
---

# Auditing and tracing Tableau workbooks

These tools read Tableau workbooks from the local disk and return their structure.
Everything runs on the user's machine; no file is uploaded.

## Always start here

Run `analyze_workbook` first on any workbook you have not seen in this conversation. It
is cheap and tells you the shape of the file (how many calculations, parameters,
worksheets and data sources) so you can choose the right follow-up instead of guessing.

## Choosing the right tool

| The user asks | Use |
| --- | --- |
| "what is wrong with this workbook", "what can I delete", "why is it slow" | `audit_workbook` |
| "what does X depend on", "what breaks if I change X" | `trace_dependencies` |
| "what changed between these two files" | `diff_workbooks` |
| "show me the calculations", "what is the formula for X" | `list_calculated_fields`, then `get_field` for one field |
| "which sheets filter on X", "what filters exist" | `list_filters` |
| "what does each sheet use" | `list_worksheets` |
| "what SQL does this run" | `list_sql_queries` |
| "draw the lineage", "give me the graph" | `get_lineage_graph` |
| "what parameters exist" | `list_parameters` |

## Never guess a file path

Every tool needs a real path to a `.twbx` or `.twb`. If the user has not given one, ask,
or offer to look in an obvious place such as `~/Downloads`. Do not invent a filename and
do not retry a path that already failed with "File not found".

## Reporting unused fields honestly

`audit_workbook` returns unused fields with a `confidence` level and a `reason`. These are
**candidates for review, not a safe-delete list**: a workbook file cannot prove a field is
unreferenced everywhere, and things like sets, groups and dashboard actions are not
visible to the parser. Always surface the confidence and the reason, and say plainly that
the user should check before deleting. Never tell someone a field is definitely safe to
remove.

## Presenting results

Tool output is JSON built for machines. Summarise it: lead with the number that answers
the question, then the specifics. For an audit, give the headline counts first (how many
unused, how much of the workbook, how many performance findings), then the highest-severity
findings with their suggested fixes. Do not paste raw JSON back at the user unless they
ask for it.

For impact questions, name the affected worksheets and dashboards, since those are the
things that actually break for a viewer.
