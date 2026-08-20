/**
 * Orchestrates the "share to X" flow:
 *   1. Ask which variant + theme to share (interactive)
 *   2. Convert the chosen SVG to a PNG buffer
 *   3. Copy the PNG to the OS clipboard
 *   4. Open X's Web Intent in the browser with a pre-filled tweet body
 *   5. The user pastes the image with Ctrl/Cmd + V
 */
import * as p from "@clack/prompts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { svgToPng } from "./png.js";
import { copyPngToClipboard } from "./clipboard/index.js";
import { openUrl } from "./browser.js";
import { summarize, buildTweetText, buildIntentUrl } from "./tweet.js";
import { VARIANTS } from "../preview.js";
import { ALL_TYPES } from "../types.js";
import type { ContribSeries } from "../types.js";

export interface ShareOptions {
  series: ContribSeries;
  /** Directory containing the rendered SVGs (e.g. "<outDir>/<variant>-<theme>.svg"). */
  outDir: string;
}

/** Run the interactive share flow. Returns true on success, false if the user
 *  cancelled or no provider was available. */
export async function runShareFlow(opts: ShareOptions): Promise<boolean> {
  const variant = await p.select({
    message: "Which variant do you want to share?",
    initialValue: VARIANTS[0].name,
    options: VARIANTS.map((v) => ({ value: v.name, label: v.label })),
  });
  if (p.isCancel(variant)) return false;

  const theme = await p.select({
    message: "Light or dark?",
    initialValue: "light" as const,
    options: [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ],
  });
  if (p.isCancel(theme)) return false;

  const chosen = VARIANTS.find((v) => v.name === variant);
  if (!chosen) return false;

  const svgPath = join(opts.outDir, `${chosen.name}-${theme}.svg`);
  // Honour the variant's `types` filter so tweet copy matches the chart image
  // (e.g. the "Commits only" variant should not list PRs/issues/reviews).
  const types = chosen.opts.types ?? [...ALL_TYPES];
  const tweetText = buildTweetText(summarize(opts.series, chosen.period, types));

  const tasks = p.spinner();
  tasks.start("Preparing the image…");

  let png: Buffer;
  try {
    const svg = await readFile(svgPath, "utf8");
    png = await svgToPng(svg);
    tasks.message("Copying to clipboard…");
  } catch (err) {
    tasks.stop("Failed to prepare image.");
    p.log.error(err instanceof Error ? err.message : String(err));
    return false;
  }

  const clip = await copyPngToClipboard(png, `gcchart-${chosen.name}-${theme}.png`);
  if (!clip.success) {
    tasks.stop("Couldn't copy image to clipboard.");
    p.log.warn(clip.error ?? "unknown clipboard error");
    p.log.info(
      `You can attach the image manually from: ${svgPath}  (or convert with any SVG-to-PNG tool).`,
    );
  } else {
    tasks.stop("Image copied to clipboard.");
  }

  const intentUrl = buildIntentUrl(tweetText);
  const opened = await openUrl(intentUrl);
  if (opened) {
    p.log.success("Opened X (Twitter) in your browser.");
  } else {
    p.log.warn("Couldn't auto-open the browser. Open this URL manually:");
    p.log.info(intentUrl);
  }

  if (clip.success) {
    p.log.info("Press Ctrl/Cmd + V to paste the image into the post composer.");
  }
  return true;
}
