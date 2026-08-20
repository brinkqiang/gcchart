/**
 * Build the X (Twitter) Web Intent URL with a pre-filled tweet body.
 * X's Web Intent API only accepts text via querystring - the image must be
 * pasted from the clipboard separately (see ../share/clipboard).
 */
import type { ContribSeries, ContribType } from "../types.js";
import { ALL_TYPES } from "../types.js";
import { formatDateRange } from "../svg/common.js";

// Match the chart legend labels exactly (see src/svg/common.ts TYPE_LABELS).
const TYPE_NOUNS: Record<ContribType, string> = {
  commit: "Commits",
  pr: "PRs",
  issue: "Issues",
  review: "Reviews",
};

export interface TweetStats {
  user: string;
  /** First and last date in the sliced window (YYYY-MM-DD UTC). Used to
   *  build the headline date range so the tweet matches the chart subtitle. */
  from: string;
  to: string;
  /** Sum of the per-type counts the chart actually shows (commit/PR/issue/
   *  review for the selectedTypes). Matches the bar totals visually. */
  visibleTotal: number;
  /** GitHub's authoritative total from contributionCalendar.contributionDays
   *  — matches the profile-page number. >= visibleTotal because it also
   *  counts repository creations and private-repo contributions whose detail
   *  the GraphQL API doesn't expose. Only meaningful when all four types are
   *  selected (otherwise it would mix unrelated buckets); 0 otherwise. */
  githubTotal: number;
  daysCovered: number;
  bestDay?: { date: string; total: number };
  byType: { commit: number; pr: number; issue: number; review: number };
  /** The contribution types included in this summary. Drives whether the tweet
   *  shows a per-type breakdown line and which "noun" labels the totals. */
  selectedTypes: ContribType[];
}

/** Aggregate the series into the small set of numbers we want in the tweet.
 *  Only the contribution types in `types` are counted, so the tweet stays
 *  consistent with the chart variant the user chose to share. */
export function summarize(
  series: ContribSeries,
  periodDays: number,
  types: ContribType[],
): TweetStats {
  const slice = series.daily.slice(-periodDays);
  const include = {
    commit: types.includes("commit"),
    pr: types.includes("pr"),
    issue: types.includes("issue"),
    review: types.includes("review"),
  };
  const byType = { commit: 0, pr: 0, issue: 0, review: 0 };
  let bestDay: TweetStats["bestDay"];
  for (const d of slice) {
    if (include.commit) byType.commit += d.commit;
    if (include.pr) byType.pr += d.pr;
    if (include.issue) byType.issue += d.issue;
    if (include.review) byType.review += d.review;
    const dayTotal =
      (include.commit ? d.commit : 0) +
      (include.pr ? d.pr : 0) +
      (include.issue ? d.issue : 0) +
      (include.review ? d.review : 0);
    if (!bestDay || dayTotal > bestDay.total) {
      bestDay = { date: d.date, total: dayTotal };
    }
  }
  const visibleTotal =
    byType.commit + byType.pr + byType.issue + byType.review;
  // GitHub total only makes sense when all four types are in scope. For the
  // commits-only / no-PR variants, restricted contributions or repo creations
  // would be unrelated noise, so we drop the second total line in that case.
  const includesAllTypes = ALL_TYPES.every((t) => types.includes(t));
  const githubTotal = includesAllTypes
    ? slice.reduce((s, d) => s + (d.total ?? 0), 0)
    : 0;
  return {
    user: series.user,
    from: slice[0]?.date ?? series.from,
    to: slice[slice.length - 1]?.date ?? series.to,
    visibleTotal,
    githubTotal,
    daysCovered: slice.length,
    bestDay,
    byType,
    selectedTypes: types,
  };
}

/** Compose the tweet body. Stays under X's 280-character limit. */
export function buildTweetText(stats: TweetStats): string {
  // Mirror the chart header: emoji + "USER's contributions" + date range.
  // Keeps the tweet visually consistent with the SVG image readers paste in.
  const single = stats.selectedTypes.length === 1 ? stats.selectedTypes[0] : null;
  const lines: string[] = [
    `🥳${stats.user}'s contributions`,
    formatDateRange(stats.from, stats.to),
    ``,
  ];

  // Mirror the chart's stacked-bar legend order (commits → PRs → issues →
  // reviews) and put Total last to match the cumulative-line legend slot.
  if (!single) {
    for (const t of ALL_TYPES) {
      if (stats.selectedTypes.includes(t)) {
        lines.push(`${TYPE_NOUNS[t]}: ${formatNum(stats.byType[t])}`);
      }
    }
  }
  // When we have GitHub's authoritative number, label our chart sum
  // "Visible total" and surface the profile-page number on a separate line so
  // readers can see both at a glance. Otherwise (single-type variants) keep
  // the historical single-line "Total".
  if (stats.githubTotal > stats.visibleTotal) {
    lines.push(`Visible total: ${formatNum(stats.visibleTotal)}`);
    lines.push(`GitHub total: ${formatNum(stats.githubTotal)}`);
  } else {
    lines.push(`Total: ${formatNum(stats.visibleTotal)}`);
  }

  if (stats.bestDay && stats.bestDay.total > 0) {
    lines.push(``);
    lines.push(`🥇Best day: ${stats.bestDay.date} (${formatNum(stats.bestDay.total)})`);
  }
  lines.push(``);
  lines.push(`Generate yours: npx gcchart`);
  lines.push(`Made by @pipipi_dev`);
  return lines.join("\n");
}

/** Builds the X Web Intent URL with the tweet text pre-filled. */
export function buildIntentUrl(text: string): string {
  const url = new URL("https://x.com/intent/tweet");
  url.searchParams.set("text", text);
  return url.toString();
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US");
}
