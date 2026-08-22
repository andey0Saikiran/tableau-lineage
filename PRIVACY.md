# Privacy Policy

_Last updated: 22 August 2026_

This policy covers **tableau-lineage.com** (the web app) and **tableau-lineage-mcp** (the
MCP server for AI assistants). Both are free and open source, and both are built by
[Sai Kiran Andey](https://www.linkedin.com/in/andeysaikiran/).

## The short version

**Your Tableau workbook never leaves your computer, and we never receive it.**

There is no server to send it to. The web app parses the file in your browser. The MCP
server parses it in a Node process running on your own machine. Neither uploads the file,
its contents, or anything derived from it.

## What we collect

**The MCP server (`tableau-lineage-mcp`): nothing.**
It makes no network requests of any kind. It reads only the workbook file paths you
explicitly pass to it, parses them in memory, and returns the results to the MCP client
that started it (for example Claude Desktop). It does not read your other files, your
conversation history, or your assistant's memory. It writes nothing to disk.

**The website (`tableau-lineage.com`): an anonymous page-view count.**
Visitor counts come from Cloudflare Web Analytics, which is cookieless and does not
profile or track individuals across sites. No account, no sign-up, and no personal data
are involved. Your workbook is never part of this: the analytics measures page views
only, and nothing about the file you open is recorded or transmitted.

## How your data is used and stored

Workbook data is held in memory for the length of the analysis and then discarded when
you close the tab or the MCP process exits. Nothing is stored on our side, because there
is no "our side": there is no database, no server-side logging, and no file retention.

Any file you download (the HTML report, CSV, JSON or Markdown documentation) is generated
on your machine and saved by your browser to a location you choose.

## Sharing with third parties

We do not share, sell, or transfer your data to anyone, because we never hold it.

Two things are worth stating plainly:

- **Your AI assistant.** When you use the MCP server through an assistant such as Claude,
  the results of a tool call (for example field names, formulas and audit findings) are
  returned to that assistant so it can answer you. Your workbook file itself is not sent.
  Your assistant's own privacy policy governs how it handles that conversation.
- **Cloudflare.** The website is hosted on Cloudflare, which processes standard web
  request data (such as IP address) to serve the page and protect against abuse, as any
  web host does.

## Data retention

None. We hold no user data, so there is nothing to retain or delete.

## Your rights

Because no personal data is collected or stored, there is no account to access, export or
delete. If you have a question or a concern, contact us using the details below.

## Verifying these claims

You do not have to take our word for any of this. The project is MIT licensed and the
full source is public at
[github.com/andey0Saikiran/tableau-lineage](https://github.com/andey0Saikiran/tableau-lineage).
You can read the code, or open your browser's network tab and watch that nothing is
uploaded.

## Changes to this policy

Material changes will be published in this file, with the date at the top updated. The
file's history is public in the repository.

## Contact

Questions about this policy, privacy concerns, or support requests:

- **GitHub issues:** https://github.com/andey0Saikiran/tableau-lineage/issues
- **Security reports:** https://github.com/andey0Saikiran/tableau-lineage/security/advisories/new
- **LinkedIn:** https://www.linkedin.com/in/andeysaikiran/
