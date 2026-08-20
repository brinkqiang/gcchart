/**
 * Shared helpers for preview HTML pages used by the CLI and the sample script.
 * Renders each variant in both light and dark, and builds an interactive page
 * with a Light/Dark toggle and copy-pasteable Markdown snippets.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { aggregate, autoGranularity } from "./aggregate.js";
import { renderSVG } from "./svg/index.js";
import { bucketTooltipJson, GEOMETRY } from "./svg/common.js";
import { summarize, buildTweetText } from "./share/tweet.js";
import type { BucketSeries, ContribSeries, ContribType, RenderOptions } from "./types.js";
import { ALL_TYPES } from "./types.js";

/** Variant-specific overrides. `theme` and `user` are intentionally excluded:
 *  the renderer assigns theme per render pass and user comes from the caller,
 *  so allowing them here would cause silent override / confusion. */
export type VariantOpts = Omit<Partial<RenderOptions>, "theme" | "user" | "period">;

export interface Variant {
  /** Slug used as a base for filenames and section headers. */
  name: string;
  /** Human-readable label shown in the section header. */
  label: string;
  period: number;
  /** Query string fragment that produces this variant when used in `outputs:`. */
  query: string;
  opts: VariantOpts;
}

export const VARIANTS: Variant[] = [
  { name: "default",       label: "Default - 1 year, weekly + total",     period: 365,  query: "",                                opts: {} },
  { name: "clean",         label: "Clean style - 1 year, weekly + total", period: 365,  query: "?style=clean",                    opts: { style: "clean" } },
  { name: "90d-daily",     label: "90 days, daily + total",               period: 90,   query: "?period=90&granularity=day",      opts: {} },
  { name: "2y-weekly",     label: "2 years, weekly + total",              period: 730,  query: "?period=730&granularity=week",    opts: {} },
  { name: "all-monthly",   label: "10 years, monthly",                    period: 3650, query: "?period=3650&granularity=month",  opts: { granularity: "month" } },
  { name: "no-cumulative", label: "Bars only (no total line)",            period: 365,  query: "?cumulative=false",               opts: { cumulative: false } },
  { name: "commits-only",  label: "Commits only",                         period: 365,  query: "?types=commit&cumulative=false",  opts: { types: ["commit"], cumulative: false } },
];

/** Per-variant rendered output. The SVG strings are inlined into the preview
 *  page as `data:` URLs so Copy / Download / Share work without a real fetch
 *  (file:// would otherwise treat sibling files as cross-origin and break
 *  canvas tainting / `<a download>`). The bucketed data drives the hover tip. */
export type VariantBuckets = Map<string, {
  buckets: BucketSeries;
  types: ContribType[];
  lightSvg: string;
  darkSvg: string;
}>;

// Inline icons (Lucide-style line icons; X uses its own logo). Width/height
// kept unset so CSS can size them via the parent button.
const ICON_COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_X = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

/** Render every variant in both light and dark to outDir. Returns the bucketed
 *  series per variant so the HTML page can build per-bar tooltip JSON without
 *  re-aggregating. */
export async function renderAllVariants(
  series: ContribSeries,
  outDir: string,
  user: string,
): Promise<VariantBuckets> {
  const out: VariantBuckets = new Map();
  for (const v of VARIANTS) {
    let lightSvg = "", darkSvg = "";
    let buckets: BucketSeries | null = null;
    let types: ContribType[] = [];
    for (const theme of ["light", "dark"] as const) {
      const r = renderVariant(series, v, theme, user);
      const file = path.join(outDir, `${v.name}-${theme}.svg`);
      await writeFile(file, r.svg, "utf8");
      console.log(`wrote ${file} (${(r.svg.length / 1024).toFixed(1)} KB)`);
      if (theme === "light") lightSvg = r.svg;
      else darkSvg = r.svg;
      buckets = r.buckets;
      types = r.types;
    }
    if (buckets) out.set(v.name, { buckets, types, lightSvg, darkSvg });
  }
  return out;
}

function renderVariant(
  series: ContribSeries,
  v: Variant,
  theme: "light" | "dark" | "auto",
  user: string,
): { svg: string; buckets: BucketSeries; types: ContribType[] } {
  const slicedDaily = series.daily.slice(-v.period);
  const sliced = {
    ...series,
    daily: slicedDaily,
    from: slicedDaily[0]?.date ?? series.from,
    to: slicedDaily[slicedDaily.length - 1]?.date ?? series.to,
  };
  const granularity = v.opts.granularity ?? autoGranularity(v.period);
  const types = v.opts.types ?? ["commit", "pr", "issue", "review"];
  const opts: RenderOptions = {
    period: v.period,
    granularity,
    cumulative: v.opts.cumulative ?? true,
    style: v.opts.style ?? "sketchy",
    theme,
    types,
    user,
  };
  const bucketed = aggregate(sliced, granularity, types);
  const visible = ALL_TYPES.filter((t) => types.includes(t));
  return { svg: renderSVG(bucketed, opts), buckets: bucketed, types: visible };
}

/**
 * Build the preview page HTML. urlUser is the GitHub username placeholder used
 * in the copy-paste snippets (e.g. "USER" for sample, the real handle for fetch).
 * `series` is used to compose per-variant tweet text for the share buttons,
 * and `variantBuckets` carries the bucketed data for the hover tooltips.
 */
export function buildPreviewHtml(
  title: string,
  urlUser: string,
  series: ContribSeries,
  variantBuckets: VariantBuckets,
): string {
  const baseUrl = `https://raw.githubusercontent.com/${urlUser}/${urlUser}/output`;
  const sections = VARIANTS.map((v) => {
    const sep = v.query ? "&" : "?";
    const lightSnippet = `![contributions](${baseUrl}/contributions.svg${v.query}${sep}theme=light)`;
    const darkSnippet  = `![contributions](${baseUrl}/contributions.svg${v.query}${sep}theme=dark)`;
    // Tip data for this variant. The chart-wrap captures hover events directly
    // (events bubble up from the <img>), so right-click on the image still
    // triggers the browser's native image context menu.
    const entry = variantBuckets.get(v.name);
    const tips = entry
      ? entry.buckets.buckets.map((b) => bucketTooltipJson(b, entry.buckets.granularity, entry.types))
      : [];
    const tipsAttr = escapeAttr(`[${tips.join(",")}]`);
    // Pre-compose the share-to-X tweet text so the Share button can just open
    // the X intent URL with it (mirrors the CLI's share flow).
    const types: ContribType[] = entry?.types ?? [...ALL_TYPES];
    const tweetText = buildTweetText(summarize(series, v.period, types));
    const tweetAttr = escapeAttr(tweetText);
    // Inline SVGs as data URLs so the page works fully when opened via file://
    // (otherwise canvas tainting + cross-origin would break Copy/Download/Share).
    const lightSrc = entry ? svgToDataUrl(entry.lightSvg) : "";
    const darkSrc  = entry ? svgToDataUrl(entry.darkSvg)  : "";
    return `
<section class="variant" data-tips="${tipsAttr}" data-tweet="${tweetAttr}" data-name="${v.name}">
  <h2>${escapeHtml(v.label)}</h2>
  <div class="chart-wrap">
    <img class="img-light" src="${lightSrc}" alt="${escapeAttr(v.label)} (light)">
    <img class="img-dark"  src="${darkSrc}"  alt="${escapeAttr(v.label)} (dark)">
    <div class="chart-actions">
      <button class="action-btn" data-action="copy"     type="button" title="Copy as PNG"   aria-label="Copy as PNG">${ICON_COPY}</button>
      <button class="action-btn" data-action="download" type="button" title="Download SVG"  aria-label="Download SVG">${ICON_DOWNLOAD}</button>
      <button class="action-btn" data-action="share"    type="button" title="Share on X"    aria-label="Share on X">${ICON_X}</button>
    </div>
  </div>
  <div class="snippet">
    <pre><code data-light="${escapeAttr(lightSnippet)}" data-dark="${escapeAttr(darkSnippet)}">${escapeHtml(lightSnippet)}</code></pre>
    <button class="copy-md" type="button">Copy</button>
  </div>
</section>`;
  }).join("\n");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
<style>
  :root { --bg:#ffffff; --fg:#1f2328; --muted:#656d76; --border:#d0d7de; --card:#f6f8fa; --accent:#2da44e; }
  body[data-theme="dark"] { --bg:#0d1117; --fg:#e6edf3; --muted:#8b949e; --border:#30363d; --card:#161b22; --accent:#3fb950; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: var(--bg); color: var(--fg); }
  .container { max-width: 980px; margin: 0 auto; padding: 24px; }
  header { position: sticky; top: 0; background: var(--bg); padding: 16px 0; border-bottom: 1px solid var(--border); z-index: 10; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .desc { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
  .toggle { display: inline-flex; gap: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .toggle button { background: var(--bg); color: var(--fg); border: 0; padding: 8px 16px; cursor: pointer; font-size: 13px; }
  .toggle button.active { background: var(--accent); color: #fff; }
  .variant { margin-top: 32px; padding: 20px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; }
  .variant h2 { margin: 0 0 12px; font-size: 15px; }
  /* Cursor toggled by JS: crosshair in chart inner area, default elsewhere.
     Using <img> (instead of <object>) so right-click gives the browser's
     native image context menu (Copy image / Save image as) - matches what
     users see when the SVG is embedded in a README via <img> as well. */
  .chart-wrap { position: relative; width: 100%; max-width: 920px; aspect-ratio: 3 / 2; }
  .variant img { display: block; width: 100%; height: 100%; border: 1px solid var(--border); border-radius: 6px; background: #fff; }
  body[data-theme="light"] .img-dark { display: none; }
  body[data-theme="dark"]  .img-light { display: none; }
  body[data-theme="dark"]  .variant img { background: transparent; }
  /* Top-right action buttons (Copy / Download / Share). z-index keeps them
     above the chart image; pointer-events stay default so clicks land on the
     buttons but the right-click image menu still works on bare image area. */
  .chart-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; z-index: 5; }
  .action-btn {
    width: 32px; height: 32px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.9); color: #1f2328;
    border: 1px solid rgba(208,215,222,0.9); border-radius: 6px;
    /* Subtle shadow gives the button depth so it stays visible against the
       chart's white background in light theme. */
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    cursor: pointer; transition: background 0.1s, color 0.1s;
  }
  .action-btn:hover { background: #fff; }
  .action-btn svg { width: 16px; height: 16px; display: block; }
  body[data-theme="dark"] .action-btn {
    background: rgba(22,27,34,0.85); color: #e6edf3;
    border-color: rgba(48,54,61,0.9);
    /* Stronger shadow on dark theme since the 8% black shadow above is invisible
       against dark chart backgrounds. */
    box-shadow: 0 1px 3px rgba(0,0,0,0.35);
  }
  body[data-theme="dark"] .action-btn:hover { background: rgba(22,27,34,1); }
  /* Inverted (pressed) state while flashing - matches the page's foreground
     color so it reads as confirmation without picking a specific accent. */
  .action-btn.success { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  /* Share modal - blocks before opening X so the user reads the paste hint
     while still on this tab. Open X is the primary action; Cancel/backdrop
     dismisses. */
  /* Modal kept in layout; visibility + opacity transitions animate both
     open and close. Close fade-out works because the visibility flip is
     delayed until the opacity transition finishes. */
  .cb-modal {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    opacity: 0; visibility: hidden;
    transition: opacity 0.16s ease-out, visibility 0s linear 0.16s;
  }
  .cb-modal.visible {
    opacity: 1; visibility: visible;
    transition: opacity 0.16s ease-out, visibility 0s linear 0s;
  }
  .cb-modal-card { transform: scale(0.96); transition: transform 0.16s ease-out; }
  .cb-modal.visible .cb-modal-card { transform: scale(1); }
  /* Respect users who prefer reduced motion - drop all transitions. */
  @media (prefers-reduced-motion: reduce) {
    .cb-modal, .cb-modal-card, .cb-tip, .action-btn { transition: none; }
    .cb-modal-card { transform: none; }
  }
  .cb-modal-card {
    background: var(--bg); color: var(--fg);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 20px 22px; max-width: 420px; width: 100%;
    box-shadow: 0 10px 36px rgba(0,0,0,0.3);
  }
  .cb-modal-card h3 { margin: 0 0 8px; font-size: 16px; }
  .cb-modal-card p { margin: 0 0 18px; font-size: 13px; line-height: 1.5; color: var(--muted); }
  .cb-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .cb-modal-actions button {
    padding: 8px 16px; font-size: 13px;
    border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg); color: var(--fg); cursor: pointer;
  }
  .cb-modal-actions .primary { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  .cb-modal-actions button:hover { filter: brightness(1.05); }
  body[data-theme="dark"] .cb-modal-actions button:hover { filter: brightness(1.2); }
  .snippet { display: flex; gap: 8px; margin-top: 12px; align-items: stretch; }
  .snippet pre { flex: 1; margin: 0; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; font-size: 12px; line-height: 1.4; white-space: pre-wrap; word-break: break-all; }
  .snippet code { font-family: ui-monospace, SFMono-Regular, "Menlo", monospace; }
  .copy-md { background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 6px; padding: 0 14px; cursor: pointer; font-size: 13px; }
  .copy-md:hover { background: var(--card); }
  .cb-tip {
    position: fixed; pointer-events: none; z-index: 100;
    background: rgba(15,17,21,0.92); color: #f4f6f9;
    padding: 8px 10px; border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px; line-height: 1.45; white-space: nowrap;
    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    opacity: 0; transition: opacity 0.08s linear;
  }
  .cb-tip.visible { opacity: 1; }
  .cb-tip .d { font-weight: 600; padding-bottom: 4px; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.18); }
  .cb-tip .row { display: flex; align-items: center; gap: 6px; }
  .cb-tip .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; flex: 0 0 10px; }
  .cb-tip .tot { margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.18); font-weight: 600; }
</style>
</head><body data-theme="light">
<div class="container">
  <header>
    <h1>${escapeHtml(title)}</h1>
    <p class="desc">Pick a chart for your profile README or SNS sharing!</p>
    <div class="toggle">
      <button data-set-theme="light" class="active">☀ Light</button>
      <button data-set-theme="dark">☾ Dark</button>
    </div>
  </header>
  ${sections}
</div>
<script>
  const body = document.body;
  document.querySelectorAll('[data-set-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-set-theme');
      body.setAttribute('data-theme', t);
      document.querySelectorAll('[data-set-theme]').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('code[data-light]').forEach((c) => {
        c.textContent = t === 'dark' ? c.getAttribute('data-dark') : c.getAttribute('data-light');
      });
    });
  });
  function flash(btn, msg) {
    const orig = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => (btn.textContent = orig), 1500);
  }
  // Markdown: copy the visible snippet text (light or dark variant).
  document.querySelectorAll('.copy-md').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.parentElement.querySelector('code');
      try {
        await navigator.clipboard.writeText(code.textContent);
        flash(btn, 'Copied!');
      } catch (e) {
        flash(btn, 'Copy failed');
      }
    });
  });

  // Chart action buttons (top-right of each chart): Copy as PNG, Download SVG,
  // Share on X. Mirrors the CLI's share flow - Share copies PNG to clipboard
  // AND opens the X intent in a new tab. The <img> src is a data: URL, so we
  // can paint it to a canvas without taint and use its src directly for
  // <a download> - works even when the page is opened via file://.
  async function imgToPngBlob(img) {
    if (!img.complete) await img.decode();
    const scale = 2; // crisper PNG when pasted into Twitter/Slack
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    });
  }
  // Success feedback: briefly swap the icon to a checkmark. No color flash,
  // so it's calm. Per-button caching of the original innerHTML survives rapid
  // clicks (without it, a second click within 800ms would capture the
  // checkmark as "original" and leave the button stuck).
  const ICON_CHECK_HTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  function flashBtn(btn) {
    if (btn._flashT) clearTimeout(btn._flashT);
    else btn._origHtml = btn.innerHTML;
    btn.innerHTML = ICON_CHECK_HTML;
    btn.classList.add('success');
    btn._flashT = setTimeout(() => {
      btn.innerHTML = btn._origHtml;
      btn.classList.remove('success');
      btn._flashT = null;
    }, 800);
  }
  function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  // Share modal - shown before opening X so the user reads the paste hint
  // while still focused on this tab. The Open X button opens the new tab
  // from a fresh user click, which keeps popup blockers happy and matches
  // the user's mental model ("OK, now go to X").
  const shareModal = document.createElement('div');
  shareModal.className = 'cb-modal';
  shareModal.innerHTML =
    '<div class="cb-modal-card" role="dialog" aria-modal="true" aria-labelledby="cb-modal-title" aria-describedby="cb-modal-msg">' +
      '<h3 id="cb-modal-title">Share on X</h3>' +
      '<p id="cb-modal-msg" class="cb-modal-msg" aria-live="polite"></p>' +
      '<div class="cb-modal-actions">' +
        '<button class="cb-modal-cancel" type="button">Cancel</button>' +
        '<button class="cb-modal-open primary" type="button">Open X</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(shareModal);
  const modalMsg    = shareModal.querySelector('.cb-modal-msg');
  const modalOpen   = shareModal.querySelector('.cb-modal-open');
  const modalCancel = shareModal.querySelector('.cb-modal-cancel');
  let pendingShareUrl = '';
  let modalTrigger = null; // element to refocus after close (a11y)
  let pendingUnlock;
  function unlockBody() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    pendingUnlock = null;
  }
  function closeModal() {
    if (!shareModal.classList.contains('visible')) return;
    shareModal.classList.remove('visible');
    // preventScroll so refocusing the share button doesn't bounce the page
    // when the trigger is partially out of view.
    if (modalTrigger && typeof modalTrigger.focus === 'function') modalTrigger.focus({ preventScroll: true });
    modalTrigger = null;
    clearTimeout(pendingUnlock);
    // With reduced motion the modal disappears instantly, so unlock the body
    // immediately - otherwise the user perceives a delayed layout shift after
    // the modal is already gone. Otherwise wait for the fade-out to finish so
    // the scrollbar/sticky-header reflow happens behind the invisible modal.
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) unlockBody();
    else pendingUnlock = setTimeout(unlockBody, 180);
  }
  function openShareModal(url, copied) {
    pendingShareUrl = url;
    modalTrigger = document.activeElement;
    modalMsg.textContent = copied
      ? 'Image copied to clipboard. Click Open X, then paste with Ctrl/Cmd+V in the tweet composer to attach it.'
      : 'Could not auto-copy the image. Click Copy first, then Share again - or open X now without an image.';
    // Cancel a pending unlock from a quick re-open so paddingRight stays correct.
    if (pendingUnlock) { clearTimeout(pendingUnlock); pendingUnlock = null; }
    // Compensate the disappearing scrollbar so the page doesn't shift right
    // when overflow is locked (mostly visible on Windows / classic scrollbars).
    const sw = window.innerWidth - document.documentElement.clientWidth;
    if (sw > 0) document.body.style.paddingRight = sw + 'px';
    document.body.style.overflow = 'hidden';
    shareModal.classList.add('visible');
    setTimeout(() => modalOpen.focus(), 0);
  }
  modalOpen.addEventListener('click', () => {
    if (pendingShareUrl) window.open(pendingShareUrl, '_blank', 'noopener,noreferrer');
    closeModal();
  });
  modalCancel.addEventListener('click', closeModal);
  shareModal.addEventListener('click', (e) => { if (e.target === shareModal) closeModal(); });
  // Focus trap: cycle Tab between Cancel and Open X while modal is open.
  shareModal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const seq = [modalCancel, modalOpen];
    const i = seq.indexOf(document.activeElement);
    if (i === -1) { e.preventDefault(); seq[0].focus(); return; }
    if (e.shiftKey && i === 0) { e.preventDefault(); seq[seq.length - 1].focus(); }
    else if (!e.shiftKey && i === seq.length - 1) { e.preventDefault(); seq[0].focus(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  document.querySelectorAll('.chart-actions .action-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-action');
      const section = btn.closest('.variant');
      if (!section) return;
      const name = section.getAttribute('data-name') || 'chart';
      const tweetText = section.getAttribute('data-tweet') || '';
      const theme = document.body.getAttribute('data-theme') || 'light';
      const imgEl = section.querySelector(theme === 'dark' ? '.img-dark' : '.img-light');
      if (!imgEl) return;
      try {
        if (action === 'download') {
          downloadFile(imgEl.src, name + '-' + theme + '.svg');
          flashBtn(btn);
        } else if (action === 'copy') {
          const blob = await imgToPngBlob(imgEl);
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          flashBtn(btn);
        } else if (action === 'share') {
          // X Web Intent has no media-attach parameter, so the user must paste
          // the image manually in the composer. Copy first, then show a modal
          // explaining the paste step before letting the user open X. The X
          // tab is opened from the modal's button (a fresh user click), so
          // popup blockers stay quiet.
          let copied = false;
          try {
            const blob = await imgToPngBlob(imgEl);
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            copied = true;
          } catch (e) { console.warn('share: png copy skipped', e); }
          openShareModal('https://x.com/intent/tweet?text=' + encodeURIComponent(tweetText), copied);
          flashBtn(btn);
        }
      } catch (err) {
        // Failures are logged to the console; no jarring color flash.
        console.error('action ' + action + ' failed:', err);
      }
    });
  });

  // Rich hover tooltips - overlay-based hit testing (Chart.js index mode style).
  // Each section carries data-tips JSON; an absolutely-positioned overlay div
  // captures mouse events and we map mouse-x to a column index using the SVG's
  // fixed viewBox geometry. This avoids cross-origin contentDocument access
  // (which file:// blocks) and works in any browser.
  const VIEW_W = ${GEOMETRY.W};
  const MARGIN_LEFT = ${GEOMETRY.margin.left};
  const MARGIN_TOP = ${GEOMETRY.margin.top};
  const INNER_W = ${GEOMETRY.innerW};
  const INNER_H = ${GEOMETRY.innerH};

  const tip = document.createElement('div');
  tip.className = 'cb-tip';
  document.body.appendChild(tip);

  function tipHtml(d) {
    const rows = d.i.map((it) =>
      '<div class="row"><span class="sw" style="background:' + it.c + '"></span>' +
      it.l + ': <strong>' + it.v + '</strong></div>'
    ).join('');
    return '<div class="d">' + d.d + '</div>' + rows +
      '<div class="tot">Total: <strong>' + d.t + '</strong></div>';
  }
  function placeTip(x, y) {
    const r = tip.getBoundingClientRect();
    const pad = 14;
    let left = x + pad;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - pad;
    if (left < 8) left = 8;
    let top = y - r.height / 2;
    if (top < 8) top = 8;
    if (top + r.height > window.innerHeight - 8) top = window.innerHeight - r.height - 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { tip.classList.remove('visible'); }

  document.querySelectorAll('.variant').forEach((section) => {
    let tips;
    try { tips = JSON.parse(section.getAttribute('data-tips') || '[]'); } catch (e) { return; }
    if (!tips.length) return;
    const wrap = section.querySelector('.chart-wrap');
    if (!wrap) return;
    const slot = INNER_W / tips.length;
    let lastIdx = -1;

    // Listen on chart-wrap (the parent). Events bubble up from <img>, so we
    // get mousemove without intercepting right-click/contextmenu - the image
    // still receives those natively.
    wrap.addEventListener('mousemove', (e) => {
      const r = wrap.getBoundingClientRect();
      const scale = r.width / VIEW_W;
      const svgX = (e.clientX - r.left) / scale;
      const svgY = (e.clientY - r.top) / scale;
      // Restrict to the chart inner area; outside it (axes, legend, header), hide.
      if (svgX < MARGIN_LEFT || svgX > MARGIN_LEFT + INNER_W ||
          svgY < MARGIN_TOP || svgY > MARGIN_TOP + INNER_H) {
        wrap.style.cursor = 'default';
        hideTip(); lastIdx = -1; return;
      }
      wrap.style.cursor = 'crosshair';
      const raw = Math.floor((svgX - MARGIN_LEFT) / slot);
      const idx = Math.min(tips.length - 1, Math.max(0, raw));
      if (idx !== lastIdx) {
        tip.innerHTML = tipHtml(tips[idx]);
        lastIdx = idx;
      }
      tip.classList.add('visible');
      placeTip(e.clientX, e.clientY);
    });
    wrap.addEventListener('mouseleave', () => { hideTip(); lastIdx = -1; });
  });
</script>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}
function escapeAttr(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"));
}
/** Convert an SVG string to a `data:` URL. Base64 keeps the encoding simple
 *  (no per-byte escaping rules to get wrong) at the cost of ~33% size. */
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
