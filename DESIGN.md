# Design

Visual system for the Tableau Lineage Visualizer. Register: **product** (the design
serves a task). Identity preserved from the original tool: Tableau-adjacent blue with
field-type accent colors that carry meaning (calc / raw / parameter / LOD).

## Theme

Light, calm, analytical. A near-white cool-tinted canvas so the colored dependency
graph and field-type accents read clearly. The physical scene: an analyst at a desk,
daytime, screen-lit, focused on reading an unfamiliar workbook — light UI keeps the
graph legible and feels like a precise instrument, not a flashy marketing page.

Color strategy: **Restrained** — tinted neutrals + a single brand accent for primary
actions and state, with a small fixed set of semantic field-type hues used only where
they encode meaning (node types, badges, legend). Never decorative.

## Color palette

Brand / primary
- `--brand-500` `#0078d4` — Tableau blue; primary actions, links, current selection
- `--brand-600` `#005a9e` — hover/active for primary
- `--brand-700` `#004578` — pressed

Field-type semantics (meaningful, not decorative)
- Calculated field — `#0078d4` (blue)
- Raw field — `#10b981` (green)
- Parameter — `#ec4899` (pink)
- LOD — `#a21caf` (purple)
- Data-source cluster — `#8b5cf6` (violet)

Neutrals (cool-tinted)
- `--bg` `#f4f7fb` — app canvas
- `--surface` `#ffffff` — cards, panels, header
- `--border` `#e2e8f0`
- `--ink` `#0f172a` — primary text (≥4.5:1 on bg and surface)
- `--muted` `#475569` — secondary text (passes AA on surface)

State
- focus ring `rgba(0,120,212,0.5)`, success `#10b981`, warning `#f59e0b`, danger `#ef4444`

## Typography

One family: **Inter** (with `Segoe UI` / system fallback); mono `ui-monospace` for
formulas. Fixed rem scale (product register — not fluid):
- Display/h1 2.25rem/700, h2 1.5rem/700, h3 1.125rem/600
- Body 1rem/400, label 0.8125rem/600, micro 0.6875rem/700 uppercase (legend/badges only)
- Scale ratio ~1.2; weight contrast carries hierarchy. No display fonts in UI labels.

## Components

State-complete: every interactive element has default / hover / focus-visible / active /
disabled where applicable.
- **Buttons**: primary (filled brand), secondary (outline), success (filled green for
  download). Consistent radius (`0.625rem`), 150–200ms transitions.
- **Upload dropzone**: dashed border, drag-over emphasis, keyboard-activatable, shows
  selected filename + size.
- **Stat cards**: compact metric tiles (data sources, calculated, raw, parameters, LOD,
  table calcs) — informational, not the hero-metric template.
- **Slide-over panels** (About, Privacy): native focus management, ESC to close, dialog
  role, focus restore.
- **Toast**: `aria-live=polite`, auto-dismiss, single instance.
- **Visualizer**: the report rendered in a sandboxed `<iframe srcdoc>` (graph + dictionary).
- **Language selector**: real listbox semantics; updates `<html lang>`.

## Layout

- Centered single column, max ~960px for upload/stats; the visualizer goes near-full-width
  (`max ~96rem`) since the graph wants room.
- Responsive is structural: stat grid uses `repeat(auto-fit, minmax(150px, 1fr))`;
  toolbar wraps; panels go full-width and legend hides on small screens.
- Semantic z-index scale: base → sticky header → panel-backdrop → panel → toast.

## Motion

- 150–250ms, ease-out. Used for state only: upload hover, panel slide-in, toast, stat
  cards entering once on result. No page-load choreography.
- `prefers-reduced-motion: reduce` collapses all transitions to near-instant / crossfade.
