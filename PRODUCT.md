# Product

## Register

product

## Users

Tableau authors, BI/analytics engineers, and data analysts who inherit or maintain
`.twbx` workbooks and need to understand them fast: which calculated fields exist,
what each formula depends on, where parameters and LOD/table calcs are used, and how
fields chain together. Often used while auditing someone else's workbook, documenting
one before handoff, or debugging a calculation. Frequently handling sensitive data, so
"my file is not uploaded anywhere" is a real requirement, not a nicety.

## Product Purpose

A privacy-first web app that visualizes the field-level lineage, calculated-field
dependencies, and metadata inside any Tableau workbook (.twbx) — entirely in the
browser. The user drops a `.twbx`, and the tool maps every calculated field, its
formula, its raw-field and parameter dependencies, and renders an interactive
dependency graph plus a searchable data dictionary. Success = a user understands an
unfamiliar workbook in minutes and can export a self-contained report to share, with
zero data ever leaving their machine.

## Brand Personality

Trustworthy, precise, quietly technical. Three words: **clear, exact, private.** The
voice is plain and concrete — it names what the tool does (parse, map, export) rather
than selling it. Confidence comes from doing the analytical work correctly and from a
privacy promise that is literally true in the code, not from adjectives.

## Anti-references

- Generic SaaS landing pages with a gradient hero, hero-metric template, and identical
  feature-card grids.
- Heavy "enterprise data governance" dashboards that bury the one task under chrome.
- Anything that *claims* privacy while quietly phoning home. The architecture must back
  the claim (no upload, no backend, no cookies).

## Design Principles

1. **Practice what you preach.** The privacy promise is enforced by architecture (all
   parsing in-browser, no network for file handling), not just stated.
2. **The graph is the product.** Everything else (upload, stats, panels) exists to get
   the user to an accurate, legible dependency graph quickly.
3. **Earned familiarity.** Standard affordances, predictable controls; the tool
   disappears into the task. Delight lives in small moments, not decoration.
4. **Correct over flashy.** Faithful extraction (fixing the original's parameter and
   table-calc bugs) matters more than visual novelty.
5. **One artifact, two homes.** What you see in-app is exactly what you download — the
   same self-contained, watermarked HTML report.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Keyboard-navigable upload, controls, panels, and language selector;
visible focus states; body text ≥4.5:1 contrast; field-type encoding never relies on
color alone (shape + label + badge back it up); honor `prefers-reduced-motion`; the
`<html lang>` updates with the language selector; the graph canvas carries a text/list
equivalent (the searchable Dictionary view) for non-visual access.
