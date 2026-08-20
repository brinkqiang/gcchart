import type { BucketPoint, BucketSeries, ContribType, Granularity, RenderOptions } from "../types.js";
import { ALL_TYPES } from "../types.js";

/** Fixed Muted (Tailwind 500) palette. */
export const PALETTE = {
  commit: "#10b981",
  pr: "#a855f7",
  issue: "#f59e0b",
  review: "#3b82f6",
  accent: "#ef4444", // total line
} as const;

export interface ThemeColors {
  fg: string;
  muted: string;
  grid: string;
  axis: string;
  bg: string;
}

export const LIGHT: ThemeColors = {
  fg: "#1f2328",
  muted: "#656d76",
  grid: "#eaeef2",
  axis: "#1f2328",
  bg: "#ffffff",
};
export const DARK: ThemeColors = {
  fg: "#e6edf3",
  muted: "#8b949e",
  grid: "#21262d",
  axis: "#e6edf3",
  bg: "#0d1117",
};

/** Compute "nice" tick positions like Chart.js (1/2/5 × 10^k stepping).
 * Contribution counts are integers, so the step is clamped to ≥ 1 to avoid
 * fractional-step ticks rounding to duplicates (e.g. max=1 producing 0,0,0,1,1,1).
 */
export function niceTicks(maxVal: number, target = 6): number[] {
  if (maxVal <= 0) return [0, 1];
  const rough = maxVal / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const rawStep = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const step = Math.max(1, Math.round(rawStep));
  const ticks: number[] = [];
  for (let v = 0; v <= maxVal + step / 2; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < maxVal) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function dailyTotal(series: BucketSeries): number[] {
  return series.buckets.map((b) => b.commit + b.pr + b.issue + b.review);
}

export function cumulative(arr: number[]): number[] {
  let s = 0;
  return arr.map((v) => (s += v));
}

/** Chooses x-axis label format based on granularity. */
export function xLabelFor(date: string, g: BucketSeries["granularity"]): string {
  const d = new Date(`${date}T00:00:00Z`);
  const m = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (g === "day") return `${m} ${d.getUTCDate()}`;
  if (g === "week") return `${m} ${d.getUTCDate()}`;
  return `${m} '${String(d.getUTCFullYear()).slice(2)}`;
}

export function yTitleFor(g: BucketSeries["granularity"]): string {
  return g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly";
}

export function totalLabel(opts: RenderOptions): string {
  const days = opts.period;
  if (days < 60) return `Total (${days} days)`;
  if (days < 365) return `Total (${Math.round(days / 30)} months)`;

  // Snap near-whole-year periods to the integer year (within ~14 days).
  const yearsExact = days / 365;
  const yearsRounded = Math.round(yearsExact);
  const isWhole = Math.abs(yearsRounded - yearsExact) < 0.04;

  // Spell out integer years 1-9 - handwritten "1" looks like a vertical stroke
  // in cursive fonts, so the digit form ("1 year") is hard to read.
  const WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  if (isWhole && yearsRounded >= 1 && yearsRounded <= 9) {
    return `Total (${WORDS[yearsRounded - 1]} year${yearsRounded === 1 ? "" : "s"})`;
  }
  // Otherwise fall back to months so we don't render a bare "1.5" either.
  return `Total (${Math.round(days / 30)} months)`;
}

/** Formats a date range. When the two dates fall in the same month, includes
 * day numbers (e.g. "Mar 12 - Mar 15, 2025") so the period length is visible.
 * Otherwise uses month + year only ("Jan 2024 - Mar 2025"). */
export function formatDateRange(from: string, to: string): string {
  const dFrom = new Date(`${from}T00:00:00Z`);
  const dTo = new Date(`${to}T00:00:00Z`);
  const fmtMY = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const sameMonth =
    dFrom.getUTCFullYear() === dTo.getUTCFullYear() && dFrom.getUTCMonth() === dTo.getUTCMonth();
  if (sameMonth) {
    if (from === to) {
      return dFrom.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    }
    const fmtMD = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return `${fmtMD(dFrom)} - ${fmtMD(dTo)}, ${dFrom.getUTCFullYear()}`;
  }
  return `${fmtMY(dFrom)} - ${fmtMY(dTo)}`;
}

/** Plural label for a contribution type - used in both legend and subtitle so
 *  the wording stays consistent. Title Case throughout for visual uniformity
 *  with the "Total" line and to match the share-to-X tweet copy. */
export const TYPE_LABELS: Record<ContribType, string> = {
  commit: "Commits",
  pr: "PRs",
  issue: "Issues",
  review: "Reviews",
};

/** Build a metadata suffix for the subtitle: "· commits only", "· no total line", etc.
 * Filtered types are emitted in canonical (ALL_TYPES) order so they line up with the legend.
 * Returns "" when no filters are in effect. */
export function subtitleSuffix(opts: RenderOptions): string {
  const parts: string[] = [];
  const selected = ALL_TYPES.filter((t) => opts.types.includes(t));
  if (selected.length < ALL_TYPES.length) {
    parts.push(
      selected.length === 1
        ? `${TYPE_LABELS[selected[0]]} only`
        : selected.map((t) => TYPE_LABELS[t]).join(" + "),
    );
  }
  if (!opts.cumulative) parts.push("no total line");
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&apos;",
  );
}

/** Tooltip text for a stacked bar - shown via SVG `<title>` so the per-day
 *  breakdown is visible on hover without any JS. Bucket date is formatted to
 *  match the chart's x-axis label granularity (day/week start, or month). */
export function bucketTooltip(
  bucket: BucketPoint,
  granularity: Granularity,
  types: ContribType[],
): string {
  const dateLabel = formatBucketLabel(bucket.date, granularity);
  const parts = types.map((t) => `${TYPE_LABELS[t]}: ${bucket[t]}`);
  const total = types.reduce((s, t) => s + bucket[t], 0);
  return `${dateLabel} - ${parts.join(", ")} (Total: ${total})`;
}

/** Structured tooltip payload embedded as `data-tip` on each bar group. The
 *  preview HTML reads this via JS to render a styled tooltip; bare SVG viewers
 *  fall back to the `<title>` text (`bucketTooltip`). Short keys keep the
 *  payload small enough that adding it to every bar is negligible (~100 bytes
 *  ×~100 bars). */
export function bucketTooltipJson(
  bucket: BucketPoint,
  granularity: Granularity,
  types: ContribType[],
): string {
  const items = types.map((t) => ({ l: TYPE_LABELS[t], c: PALETTE[t], v: bucket[t] }));
  const total = types.reduce((s, t) => s + bucket[t], 0);
  return JSON.stringify({ d: formatBucketLabel(bucket.date, granularity), i: items, t: total });
}

function formatBucketLabel(dateStr: string, granularity: Granularity): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const m = MONTHS_SHORT[d.getUTCMonth()];
  if (granularity === "month") return `${m} ${d.getUTCFullYear()}`;
  // For week buckets, the date represents the week's start - formatting it as
  // a single day is acceptable shorthand and matches the x-axis tick labels.
  return `${m} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ChartGeometry {
  W: number;
  H: number;
  margin: { top: number; right: number; bottom: number; left: number };
  innerW: number;
  innerH: number;
}

export const GEOMETRY: ChartGeometry = (() => {
  const W = 900;
  const H = 600; // 3:2
  // top has extra room for header (icon+title) and a date-range subtitle.
  // bottom holds the legend (innerH+56) plus a brand-mark line below it
  // (centered, near the SVG's bottom edge) - see renderBranding().
  const margin = { top: 100, right: 90, bottom: 110, left: 80 };
  return { W, H, margin, innerW: W - margin.left - margin.right, innerH: H - margin.top - margin.bottom };
})();

/** Shrinks the title font size if the rendered text would exceed `maxWidth`.
 * Uses an empirical glyph-width factor (≈ 0.55 em) to estimate render width
 * without measuring; conservative so the header always fits. */
export function fitTitleFontSize(text: string, baseFontSize: number, maxWidth: number): number {
  const len = Math.max(text.length, 1); // guard divide-by-zero for empty input
  const estWidth = (size: number) => len * size * 0.55;
  if (estWidth(baseFontSize) <= maxWidth) return baseFontSize;
  // Scale down, with a floor so the title stays readable.
  const scaled = Math.floor((maxWidth / len) / 0.55);
  return Math.max(11, scaled);
}

/** Renders the brand mark ("npx gcchart") at the bottom-center and the author
 *  credit ("made by @pipipi-dev") at the bottom-right. The center mark
 *  promotes how to make one; the right mark gives author attribution. Both
 *  styled muted via low opacity. Uses the GitHub handle (hyphen) since the
 *  chart is embedded on GitHub - the X handle (underscore) is reserved for
 *  the share-to-X tweet body. */
export function renderBranding(): string {
  const y = GEOMETRY.H - 18;
  const center = GEOMETRY.W / 2;
  // Right edge inset 40px so the credit sits visually inside the chart frame
  // rather than hanging off the SVG's outer edge (right margin is 90px).
  const rightX = GEOMETRY.W - 40;
  return (
    `<text class="cb-fg" x="${center.toFixed(1)}" y="${y}" font-size="13" text-anchor="middle" opacity="0.5" letter-spacing="0.3">npx gcchart</text>` +
    `<text class="cb-fg" x="${rightX.toFixed(1)}" y="${y}" font-size="13" text-anchor="end" opacity="0.5" letter-spacing="0.3">made by @pipipi-dev</text>`
  );
}

/** Builds the mini contribution-grid icon used in the chart header. */
export function headerIconCells(
  startX: number,
  startY: number,
  cell = 5,
  gap = 2,
  size = 4,
): { cells: string; width: number; height: number } {
  const pattern = [3, 1, 2, 0, 0, 3, 1, 2, 2, 0, 3, 1, 1, 2, 0, 3];
  const shades = ["#9be9a8", "#40c463", "#30a14e", "#216e39"];
  let cells = "";
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = startX + j * (cell + gap);
      const y = startY + i * (cell + gap);
      cells += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cell}" height="${cell}" rx="1" ry="1" fill="${shades[pattern[i * size + j]]}"/>`;
    }
  }
  return { cells, width: size * cell + (size - 1) * gap, height: size * cell + (size - 1) * gap };
}
