/** Single source of truth - add new contribution types here and ContribType
 *  is automatically derived from this array. */
export const ALL_TYPES = ["commit", "pr", "issue", "review"] as const;

export type ContribType = (typeof ALL_TYPES)[number];

export interface DailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  commit: number;
  pr: number;
  issue: number;
  review: number;
  /** GitHub's official per-day total (matches the profile page contribution
   *  graph) - includes commit/PR/issue/review PLUS repository creations and
   *  private-repo contributions the GraphQL API can't expose in detail
   *  (returned as restrictedContributionsCount). Always >= sum of per-type
   *  fields. */
  total: number;
}

export interface ContribSeries {
  user: string;
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
  daily: DailyPoint[];
}

export type Granularity = "day" | "week" | "month";

export interface BucketPoint {
  /** Inclusive start date of the bucket (YYYY-MM-DD UTC). */
  date: string;
  commit: number;
  pr: number;
  issue: number;
  review: number;
}

export interface BucketSeries {
  user: string;
  from: string;
  to: string;
  granularity: Granularity;
  buckets: BucketPoint[];
}

export type Style = "sketchy" | "clean";
export type Theme = "auto" | "light" | "dark";

export interface RenderOptions {
  period: number;
  granularity: Granularity;
  cumulative: boolean;
  style: Style;
  theme: Theme;
  types: ContribType[];
  user: string;
}
