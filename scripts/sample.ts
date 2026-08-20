/**
 * Generate sample SVGs from synthetic data without hitting GitHub.
 * Run with: npm run sample
 * Outputs land in ./sample/ (sibling of ./out/, which holds real-data output).
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { ContribSeries } from "../src/types.js";
import { renderAllVariants, buildPreviewHtml } from "../src/preview.js";

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Fixed reference date so the committed sample SVGs are byte-identical across
 * runs. Bump this when you intentionally regenerate samples for a new release. */
const SAMPLE_TODAY = "2026-05-10";
const SAMPLE_USER = "demo-user";

function buildDummy(days: number): ContribSeries {
  const rand = seeded(42);
  const today = new Date(`${SAMPLE_TODAY}T00:00:00Z`);
  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dow = d.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const ramp = 0.4 + ((days - 1 - i) / days) * 0.9;
    const wkMul = isWeekend ? 0.25 : 1.0;
    const spike = rand() < 0.04 ? 3 + rand() * 4 : 1;
    const base = ramp * wkMul * spike;
    const commit = Math.max(0, Math.round(rand() * 12 * base));
    const pr = Math.max(0, Math.round(rand() * 2.5 * base));
    const issue = rand() < 0.35 ? Math.max(0, Math.round(rand() * 1.5 * base)) : 0;
    const review = rand() < 0.5 ? Math.max(0, Math.round(rand() * 3 * base)) : 0;
    daily.push({
      date: d.toISOString().slice(0, 10),
      commit,
      pr,
      issue,
      review,
      // Synthetic data has no "hidden" private/restricted activity, so the
      // GitHub-side total equals the per-type sum.
      total: commit + pr + issue + review,
    });
  }
  return { user: SAMPLE_USER, from: daily[0].date, to: daily[daily.length - 1].date, daily };
}

async function main() {
  const series = buildDummy(730);
  const outDir = path.resolve(process.cwd(), "sample");
  await mkdir(outDir, { recursive: true });

  const variantBuckets = await renderAllVariants(series, outDir, SAMPLE_USER);

  const html = buildPreviewHtml("gcchart / sample", "USER", series, variantBuckets);
  await writeFile(path.join(outDir, "index.html"), html, "utf8");
  console.log(`wrote ${path.join(outDir, "index.html")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
