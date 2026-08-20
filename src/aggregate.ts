import type { ContribSeries, BucketSeries, BucketPoint, Granularity, ContribType } from "./types.js";

/**
 * Auto-pick a granularity from the period in days:
 *   ≤ 90 days  → day
 *   ≤ 730 days → week
 *   else       → month
 */
export function autoGranularity(periodDays: number): Granularity {
  if (periodDays <= 90) return "day";
  if (periodDays <= 730) return "week";
  return "month";
}

/** Aggregates daily contributions into the requested granularity buckets. */
export function aggregate(
  series: ContribSeries,
  granularity: Granularity,
  types: ContribType[],
): BucketSeries {
  const bucketKey = bucketKeyFn(granularity);
  const map = new Map<string, BucketPoint>();
  const include: Record<ContribType, boolean> = {
    commit: types.includes("commit"),
    pr: types.includes("pr"),
    issue: types.includes("issue"),
    review: types.includes("review"),
  };
  for (const day of series.daily) {
    const key = bucketKey(day.date);
    let b = map.get(key);
    if (!b) {
      b = { date: key, commit: 0, pr: 0, issue: 0, review: 0 };
      map.set(key, b);
    }
    if (include.commit) b.commit += day.commit;
    if (include.pr) b.pr += day.pr;
    if (include.issue) b.issue += day.issue;
    if (include.review) b.review += day.review;
  }
  const buckets = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { user: series.user, from: series.from, to: series.to, granularity, buckets };
}

function bucketKeyFn(g: Granularity): (date: string) => string {
  if (g === "day") return (d) => d;
  if (g === "week") return (d) => sundayOf(d);
  return (d) => firstOfMonth(d);
}

/**
 * Returns the Sunday of the week containing the given UTC date.
 * Sunday-anchored to match GitHub's profile contribution grid (Sun → Sat).
 */
export function sundayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}
