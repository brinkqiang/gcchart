# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-05-11

### Added
- Rich hover tooltips on the preview HTML page. A styled overlay shows the
  per-bucket breakdown (Commits / PRs / Issues / Reviews / Total) as you move
  the cursor across the bars - much more discoverable than the SVG `<title>`
  fallback (which still works when the SVG file is opened directly). The
  cursor switches to a crosshair only over the chart plotting area to signal
  where the tooltip is active.
- Author credit "made by @pipipi-dev" at the bottom-right of the chart,
  alongside the existing centered "npx gcchart" install hint.
- Per-chart action buttons (Copy as PNG / Download SVG / Share on X) in the
  top-right of each preview chart. Share opens the X composer in a new tab
  and copies the PNG to your clipboard - a confirmation modal explains the
  paste step before the new tab opens, since X's Web Intent API has no media
  attachment parameter. SVGs are inlined into the preview as data URLs so
  these actions work even when the page is opened via `file://`.

### Changed
- Share-to-X tweet body now mirrors the chart header for visual consistency:
  `🥳USER's contributions` line, the date range underneath, and a `🥇Best day:`
  line at the bottom. The author attribution wording changed from
  `Credit: @pipipi_dev` to `Made by @pipipi_dev` for clarity.

## [1.0.2] - 2026-05-11

### Fixed
- Share tweet's `Total` no longer underreports your contribution count when
  you have private/restricted activity. Now shows two totals when sharing the
  full chart: `Visible total` (sum of the bars the chart actually renders)
  and `GitHub total` (the authoritative number from your GitHub profile,
  including private/restricted contributions and repository creations the
  GraphQL API can't expose in detail). Single-type variants (e.g.
  `commits-only`) keep the original single `Total` line.

## [1.0.1] - 2026-05-11

### Fixed
- X share PNG now renders chart labels (titles, axis ticks, legend) instead of
  showing only bars. The previous WASM-based renderer silently dropped text
  because it couldn't decode the embedded WOFF font or apply CSS class
  selectors. Switched to `@resvg/resvg-js` (native binding) and re-pack the
  embedded WOFF as OTF on the fly via `opentype.js` so the hand-drawn xkcd
  font is preserved in PNG exports.

## [1.0.0] - 2026-05-10 - Initial release

- **CLI** (`npx gcchart`) - one-shot SVG generation locally, interactive HTML
  preview with copy-pasteable Markdown, and an optional one-prompt share to X
  (PNG copied to clipboard, post composer pre-filled).
- **GitHub Action** - keeps your profile README continuously up to date by
  force-pushing generated SVGs to a dedicated `output` branch on a daily cron.
- **Stacked bar chart** broken down by Commits / PRs / Issues / Reviews, with
  an optional cumulative total line.
- **Two rendering styles** - hand-drawn (default) and `style=clean` formal
  line-drawing.
- **Per-output customization** via query string: `period`, `granularity`,
  `cumulative`, `style`, `theme`, `types`.
- **Auto Light/Dark** via `prefers-color-scheme` in a single SVG; `theme=light`
  / `theme=dark` to force one.
- **Lightweight & self-contained** - a single SVG file, no JS runtime, no
  external assets.
