import type { BucketSeries, RenderOptions, ContribType } from "../types.js";
import { ALL_TYPES } from "../types.js";
import {
  PALETTE,
  LIGHT,
  DARK,
  niceTicks,
  dailyTotal,
  cumulative,
  xLabelFor,
  yTitleFor,
  totalLabel,
  escapeXml,
  formatDateRange,
  subtitleSuffix,
  fitTitleFontSize,
  GEOMETRY,
  headerIconCells,
  renderBranding,
  TYPE_LABELS,
  bucketTooltip,
  type ThemeColors,
} from "./common.js";

export function renderClean(series: BucketSeries, opts: RenderOptions): string {
  const inner = renderInner(series, opts);
  const css = themeCSS(opts.theme);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GEOMETRY.W} ${GEOMETRY.H}" width="${GEOMETRY.W}" height="${GEOMETRY.H}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
<defs>
<style type="text/css">${css}</style>
</defs>
<rect class="cb-bg" x="0" y="0" width="${GEOMETRY.W}" height="${GEOMETRY.H}"/>
${inner}
${renderBranding()}
</svg>`;
}

function themeCSS(mode: "auto" | "light" | "dark"): string {
  const block = (c: ThemeColors) =>
    `.cb-bg{fill:${c.bg}}.cb-fg{fill:${c.fg}}.cb-axis{stroke:${c.muted}}.cb-grid{stroke:${c.grid}}`;
  if (mode === "light") return block(LIGHT);
  if (mode === "dark") return block(DARK);
  return `${block(LIGHT)}@media (prefers-color-scheme: dark){${block(DARK)}}`;
}

function renderInner(series: BucketSeries, opts: RenderOptions): string {
  const { innerW, innerH, margin } = GEOMETRY;
  const buckets = series.buckets;
  const n = buckets.length;
  const header = renderHeader(series, opts);
  if (n === 0) {
    return `${header}
<g transform="translate(${margin.left},${margin.top})">
<line class="cb-axis" x1="0" y1="${innerH}" x2="${innerW}" y2="${innerH}" stroke-width="1"/>
<line class="cb-axis" x1="0" y1="0" x2="0" y2="${innerH}" stroke-width="1"/>
<line class="cb-axis" x1="${innerW}" y1="0" x2="${innerW}" y2="${innerH}" stroke-width="1"/>
<text class="cb-fg" x="${(innerW / 2).toFixed(1)}" y="${(innerH / 2 - 10).toFixed(1)}" text-anchor="middle" font-size="16" opacity="0.7">${escapeXml("No contributions in the selected period.")}</text>
<text class="cb-fg" x="${(innerW / 2).toFixed(1)}" y="${(innerH / 2 + 14).toFixed(1)}" text-anchor="middle" font-size="12" opacity="0.5">${escapeXml("Account may be newer than the period, or private contributions may not be enabled.")}</text>
</g>`;
  }

  const visibleTypes: ContribType[] = ALL_TYPES.filter((t) => opts.types.includes(t));
  const totals = dailyTotal(series);
  const cum = cumulative(totals);
  const leftTicks = niceTicks(Math.max(...totals, 1), 6);
  const rightTicks = opts.cumulative ? niceTicks(cum[cum.length - 1] || 1, 6) : [];
  const maxBar = leftTicks[leftTicks.length - 1];
  const maxCum = rightTicks.length ? rightTicks[rightTicks.length - 1] : 1;

  const slot = innerW / n;
  const barW = slot * 0.8;

  // Bars - each day's stack is wrapped in a <g><title> so SVG viewers and
  // <object>-embedded previews show the per-type breakdown on hover. (See
  // sketchy.ts for the same pattern.)
  let bars = "";
  for (let i = 0; i < n; i++) {
    let yCursor = innerH;
    let stackRects = "";
    for (const k of visibleTypes) {
      const v = buckets[i][k];
      if (!v) continue;
      const h = (v / maxBar) * innerH;
      const x = i * slot + (slot - barW) / 2;
      const y = yCursor - h;
      stackRects += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${PALETTE[k]}"/>`;
      yCursor = y;
    }
    if (stackRects) {
      const tip = escapeXml(bucketTooltip(buckets[i], series.granularity, visibleTypes));
      bars += `<g><title>${tip}</title>${stackRects}</g>`;
    }
  }

  let line = "";
  if (opts.cumulative) {
    let path = "";
    for (let i = 0; i < n; i++) {
      const x = i * slot + slot / 2;
      const y = innerH - (cum[i] / maxCum) * innerH;
      path += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    }
    line = `<path d="${path}" fill="none" stroke="${PALETTE.accent}" stroke-width="3"/>`;
  }

  const tickY = (v: number, max: number) => innerH - (v / max) * innerH;
  let gridLines = "";
  for (const v of leftTicks) {
    if (v === 0) continue;
    const y = tickY(v, maxBar);
    gridLines += `<line class="cb-grid" x1="0" y1="${y.toFixed(1)}" x2="${innerW}" y2="${y.toFixed(1)}" stroke-width="1"/>`;
  }

  let yLabels = "";
  for (const v of leftTicks) {
    const y = tickY(v, maxBar);
    yLabels += `<text class="cb-fg" x="-8" y="${(y + 4).toFixed(1)}" font-size="13" text-anchor="end">${v}</text>`;
  }
  for (const v of rightTicks) {
    const y = tickY(v, maxCum);
    yLabels += `<text class="cb-fg" x="${(innerW + 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="13" text-anchor="start">${v}</text>`;
  }

  const axisTitles =
    `<text class="cb-fg" transform="translate(-50,${(innerH / 2).toFixed(1)}) rotate(-90)" font-size="13" text-anchor="middle">${yTitleFor(series.granularity)}</text>` +
    (opts.cumulative
      ? `<text class="cb-fg" transform="translate(${(innerW + 52).toFixed(1)},${(innerH / 2).toFixed(1)}) rotate(90)" font-size="13" text-anchor="middle">Total</text>`
      : "");

  let xLabels = "";
  const stride = Math.max(1, Math.ceil(n / 12));
  for (let i = 0; i < n; i += stride) {
    const x = i * slot + slot / 2;
    const lab = escapeXml(xLabelFor(buckets[i].date, series.granularity));
    xLabels += `<text class="cb-fg" x="${x.toFixed(1)}" y="${(innerH + 24).toFixed(1)}" font-size="13" text-anchor="middle">${lab}</text>`;
  }

  const legendItems: { label: string; color: string; kind: "rect" | "line" }[] = visibleTypes.map((t) => ({
    label: TYPE_LABELS[t],
    color: PALETTE[t],
    kind: "rect" as const,
  }));
  if (opts.cumulative)
    legendItems.push({ label: totalLabel(opts), color: PALETTE.accent, kind: "line" });
  const itemW = 115;
  const legendW = legendItems.length * itemW;
  const legendX = (innerW - legendW) / 2;
  const legendY = innerH + 52;
  let legend = "";
  legendItems.forEach((it, i) => {
    const x = legendX + i * itemW;
    if (it.kind === "rect") {
      legend += `<rect x="${x}" y="${legendY - 11}" width="13" height="13" fill="${it.color}"/>`;
    } else {
      legend += `<line x1="${x}" y1="${legendY - 4}" x2="${x + 16}" y2="${legendY - 4}" stroke="${it.color}" stroke-width="3"/>`;
    }
    legend += `<text class="cb-fg" x="${x + 20}" y="${legendY + 1}" font-size="13">${escapeXml(it.label)}</text>`;
  });

  return `${header}
<g transform="translate(${margin.left},${margin.top})">
<line class="cb-axis" x1="0" y1="${innerH}" x2="${innerW}" y2="${innerH}" stroke-width="1"/>
<line class="cb-axis" x1="0" y1="0" x2="0" y2="${innerH}" stroke-width="1"/>
<line class="cb-axis" x1="${innerW}" y1="0" x2="${innerW}" y2="${innerH}" stroke-width="1"/>
${gridLines}
${bars}
${line}
${yLabels}
${axisTitles}
${xLabels}
${legend}
</g>`;
}

/** Mini grid icon + title + date-range subtitle, centered above the chart. */
function renderHeader(series: BucketSeries, opts: RenderOptions): string {
  const { W } = GEOMETRY;
  const titleText = `${opts.user}'s contributions`;
  const titleFontSize = fitTitleFontSize(titleText, 19, W - 80);
  const titleApproxW = titleText.length * titleFontSize * 0.55;
  const headerCenterX = W / 2;
  const headerW = 26 + 10 + titleApproxW;
  const headerLeft = headerCenterX - headerW / 2;
  const headerTopAbs = 22;
  const icon = headerIconCells(headerLeft, headerTopAbs);
  const titleX = headerLeft + icon.width + 10;
  const titleY = headerTopAbs + icon.height / 2 + titleFontSize / 2 - 2;
  const subtitleText =
    formatDateRange(
      series.buckets[0]?.date ?? series.from,
      series.buckets[series.buckets.length - 1]?.date ?? series.to,
    ) + subtitleSuffix(opts);
  const subtitleFontSize = 12;
  const subtitleY = headerTopAbs + icon.height + subtitleFontSize + 8;
  return (
    icon.cells +
    `<text class="cb-fg" x="${titleX.toFixed(1)}" y="${titleY.toFixed(1)}" font-size="${titleFontSize}" font-weight="600">${escapeXml(titleText)}</text>` +
    `<text class="cb-fg" x="${headerCenterX.toFixed(1)}" y="${subtitleY.toFixed(1)}" font-size="${subtitleFontSize}" text-anchor="middle" opacity="0.7">${escapeXml(subtitleText)}</text>`
  );
}
