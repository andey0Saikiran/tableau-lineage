# Security Policy

## Reporting a vulnerability

Report security issues privately through
[GitHub Security Advisories](https://github.com/andey0Saikiran/tableau-lineage/security/advisories/new),
which lets us discuss and fix the issue before it is public.

If you cannot use GitHub advisories, open a
[GitHub issue](https://github.com/andey0Saikiran/tableau-lineage/issues) describing the
problem without exploit details, and we will follow up privately.

Expect an acknowledgement within 7 days.

## Scope

Both components run entirely on the user's own machine:

- **tableau-lineage.com** parses the workbook in the browser. There is no backend and no
  upload endpoint.
- **tableau-lineage-mcp** parses the workbook in a local Node process started by the
  user's own MCP client. It makes no network requests.

The most relevant threat model is therefore a **malicious workbook file**: field names,
formulas, SQL and worksheet names are all attacker-controllable text. Reports about
injection through workbook content (into the generated HTML report, the CSV or Markdown
exports, or the tool output) are especially welcome.

## Supported versions

The latest released version of each component is supported.
