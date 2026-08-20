/**
 * SVG → PNG conversion for clipboard / X share.
 *
 * Uses @resvg/resvg-js (native binding) so WOFF/TTF/OTF fonts and CSS class
 * selectors render correctly. The WASM build was tried first but silently
 * dropped text labels because it can't decode WOFF or apply class-based
 * fill rules to <text> elements.
 */
import { Resvg } from "@resvg/resvg-js";
import opentype from "opentype.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Render an SVG string to a PNG Buffer at the given pixel width
 * (height is derived from the SVG's intrinsic aspect ratio).
 */
export async function svgToPng(svg: string, widthPx = 1600): Promise<Buffer> {
  const dataUrlFonts = extractDataUrlFonts(svg);
  const tmpDir = dataUrlFonts.length
    ? await mkdtemp(path.join(tmpdir(), "gcchart-fonts-"))
    : null;
  try {
    const fontFiles: string[] = [];
    if (tmpDir) {
      for (let i = 0; i < dataUrlFonts.length; i++) {
        // resvg-js's WOFF support doesn't reliably handle CFF-flavored WOFF
        // (the xkcd Script case). Re-pack the glyph data as an OTF/TTF using
        // opentype.js, which resvg can then read without trouble.
        const woff = dataUrlFonts[i];
        const ab = woff.buffer.slice(woff.byteOffset, woff.byteOffset + woff.byteLength) as ArrayBuffer;
        const font = opentype.parse(ab);
        const otf = Buffer.from(font.toArrayBuffer());
        const file = path.join(tmpDir, `font-${i}.otf`);
        await writeFile(file, otf);
        fontFiles.push(file);
      }
    }
    const resvg = new Resvg(inlineClassStyles(svg), {
      fitTo: { mode: "width", value: widthPx },
      background: "white", // ensure transparent dark-mode SVGs paste with a solid bg
      font: {
        // Hand resvg the @font-face fonts the SVG embeds (e.g. xkcd in the
        // sketchy variant) plus host system fonts as a fallback for clean SVGs
        // that rely on Segoe UI / -apple-system. resvg-js's font option only
        // accepts file paths, so we materialize each data URL to a temp file.
        fontFiles,
        loadSystemFonts: true,
        defaultFontFamily: "xkcd Script",
      },
    });
    return Buffer.from(resvg.render().asPng());
  } finally {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/** Pull base64-encoded fonts out of `url(data:...;base64,...)` declarations
 *  inside the SVG's `<style>` block. The mediatype portion may include extra
 *  parameters (e.g. `;charset=utf-8`), so match up to the final `;base64,`
 *  boundary. */
function extractDataUrlFonts(svg: string): Buffer[] {
  const fonts: Buffer[] = [];
  for (const m of svg.matchAll(/url\(data:[^,]*;base64,([^)]+)\)/g)) {
    fonts.push(Buffer.from(m[1], "base64"));
  }
  return fonts;
}

/**
 * Inline CSS class rules (from `<style>`) as direct attributes on matching
 * elements. resvg's class selector support is limited; inlining each rule
 * as an attribute guarantees fill/stroke colors stick. `@media` blocks are
 * stripped (PNG export targets a single fixed theme; runtime
 * prefers-color-scheme switching only matters in HTML).
 */
function inlineClassStyles(svg: string): string {
  const styleMatch = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) return svg;

  const flatCss = styleMatch[1].replace(/@media[^{]*\{(?:[^{}]|\{[^}]*\})*\}/g, "");
  const rules = new Map<string, Record<string, string>>();
  for (const m of flatCss.matchAll(/\.([\w-]+)\s*\{([^}]+)\}/g)) {
    const decls: Record<string, string> = {};
    for (const decl of m[2].split(";")) {
      const [k, v] = decl.split(":").map((s) => s?.trim());
      if (k && v) decls[k] = v;
    }
    rules.set(m[1], decls);
  }
  if (rules.size === 0) return svg;

  return svg.replace(
    /<(\w+)([^>]*?)\sclass="([^"]+)"([^>]*?)(\/?>)/g,
    (_full, tag, pre, classes, post, close) => {
      let attrStr = "";
      for (const c of String(classes).split(/\s+/)) {
        const decls = rules.get(c);
        if (!decls) continue;
        for (const [k, v] of Object.entries(decls)) {
          // Skip if the element already declares this attribute explicitly.
          const re = new RegExp(`\\s${k}\\s*=`);
          if (re.test(pre + post)) continue;
          attrStr += ` ${k}="${v}"`;
        }
      }
      return `<${tag}${pre} class="${classes}"${post}${attrStr}${close}`;
    },
  );
}
