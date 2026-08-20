import { graphql } from "@octokit/graphql";
import type { DailyPoint, ContribSeries } from "./types.js";

interface GqlCommitNode {
  occurredAt: string;
  commitCount: number;
}
interface GqlEventNode {
  occurredAt: string;
}
interface GqlContributionsCollection {
  commitContributionsByRepository: { contributions: { nodes: GqlCommitNode[] } }[];
  pullRequestContributionsByRepository: { contributions: { nodes: GqlEventNode[] } }[];
  issueContributionsByRepository: { contributions: { nodes: GqlEventNode[] } }[];
  pullRequestReviewContributionsByRepository: { contributions: { nodes: GqlEventNode[] } }[];
  contributionCalendar: {
    weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
  };
}

const QUERY_USER_CREATED = /* GraphQL */ `
  query ($user: String!) {
    user(login: $user) {
      createdAt
    }
  }
`;

const QUERY_CONTRIBUTIONS = /* GraphQL */ `
  query ($user: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $user) {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 100) {
          contributions(first: 100) {
            nodes { occurredAt commitCount }
          }
        }
        pullRequestContributionsByRepository(maxRepositories: 100) {
          contributions(first: 100) {
            nodes { occurredAt }
          }
        }
        issueContributionsByRepository(maxRepositories: 100) {
          contributions(first: 100) {
            nodes { occurredAt }
          }
        }
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          contributions(first: 100) {
            nodes { occurredAt }
          }
        }
        contributionCalendar {
          weeks {
            contributionDays { date contributionCount }
          }
        }
      }
    }
  }
`;

function client(token: string) {
  return graphql.defaults({ headers: { authorization: `bearer ${token}` } });
}

function isoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns the user's account creation date (YYYY-MM-DD). */
export async function fetchUserCreatedAt(user: string, token: string): Promise<string> {
  const data = await client(token)<{ user: { createdAt: string } }>(QUERY_USER_CREATED, { user });
  return data.user.createdAt.slice(0, 10);
}

/**
 * Fetches contributions for [from, to] inclusive (both YYYY-MM-DD).
 * Each `contributions(first: 100)` connection caps at 100 nodes per
 * repository per query, so we slice the range into ~90-day windows to keep
 * every per-repo connection under that cap (e.g. a daily committer to one
 * repo would exceed 100 nodes within a single 1-year window and the older
 * days would be silently dropped).
 */
export async function fetchContributions(
  user: string,
  token: string,
  from: string,
  to: string,
): Promise<ContribSeries> {
  const dailyMap = new Map<string, DailyPoint>();
  const init = (date: string): DailyPoint => {
    let p = dailyMap.get(date);
    if (!p) {
      p = { date, commit: 0, pr: 0, issue: 0, review: 0, total: 0 };
      dailyMap.set(date, p);
    }
    return p;
  };

  // Pre-seed every day in the range with zeros so the chart shows gaps as 0.
  for (const d of dateRange(from, to)) init(d);

  const windows = splitWindows(from, to);
  const gql = client(token);

  for (const [winFrom, winTo] of windows) {
    const fromIso = `${winFrom}T00:00:00Z`;
    const toIso = `${winTo}T23:59:59Z`;
    const data = await gql<{ user: { contributionsCollection: GqlContributionsCollection } }>(
      QUERY_CONTRIBUTIONS,
      { user, from: fromIso, to: toIso },
    );
    const cc = data.user.contributionsCollection;
    accumulateCommits(dailyMap, cc.commitContributionsByRepository);
    accumulateEvents(dailyMap, cc.pullRequestContributionsByRepository, "pr");
    accumulateEvents(dailyMap, cc.issueContributionsByRepository, "issue");
    accumulateEvents(dailyMap, cc.pullRequestReviewContributionsByRepository, "review");
    accumulateCalendar(dailyMap, cc.contributionCalendar);
  }

  const daily = [...dailyMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { user, from, to, daily };
}

/** Commits carry an explicit per-day count (a single node aggregates a day for one repo). */
function accumulateCommits(
  map: Map<string, DailyPoint>,
  byRepo: { contributions: { nodes: GqlCommitNode[] } }[],
) {
  for (const repo of byRepo) {
    for (const node of repo.contributions.nodes) {
      const date = node.occurredAt.slice(0, 10);
      const point = map.get(date);
      if (!point) continue;
      point.commit += node.commitCount;
    }
  }
}

/** GitHub's per-day "true total" - includes private/restricted contributions
 *  the per-type queries can't expose (commitContributionsByRepository etc.
 *  only return public detail per the GraphQL spec). Source of truth for
 *  matching the profile-page contribution graph total. */
function accumulateCalendar(
  map: Map<string, DailyPoint>,
  cal: { weeks: { contributionDays: { date: string; contributionCount: number }[] }[] },
) {
  for (const week of cal.weeks) {
    for (const day of week.contributionDays) {
      const point = map.get(day.date);
      if (!point) continue;
      point.total += day.contributionCount;
    }
  }
}

/** PR / issue / review events are 1-per-node (each node = one created PR/issue/review). */
function accumulateEvents(
  map: Map<string, DailyPoint>,
  byRepo: { contributions: { nodes: GqlEventNode[] } }[],
  field: "pr" | "issue" | "review",
) {
  for (const repo of byRepo) {
    for (const node of repo.contributions.nodes) {
      const date = node.occurredAt.slice(0, 10);
      const point = map.get(date);
      if (!point) continue;
      point[field] += 1;
    }
  }
}

function* dateRange(from: string, to: string): Generator<string> {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield isoDateUtc(d);
  }
}

/**
 * Splits [from, to] into ≤ 90-day windows.
 * Sized so each window's per-repo `contributions(first: 100)` won't overflow
 * for a daily committer (max ~90 commit nodes per repo per window).
 */
const WINDOW_DAYS = 90;
function splitWindows(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    const winEnd = new Date(cursor);
    winEnd.setUTCDate(winEnd.getUTCDate() + (WINDOW_DAYS - 1));
    const cap = winEnd > end ? end : winEnd;
    out.push([isoDateUtc(cursor), isoDateUtc(cap)]);
    cursor = new Date(cap);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
