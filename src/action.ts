import { fetchContributions, fetchUserCreatedAt } from "./github.js";
import { aggregate } from "./aggregate.js";
import { renderSVG } from "./svg/index.js";
import { parseOutputLine, type ParsedOutput } from "./options.js";
import { pushFiles } from "./git.js";
import type { ContribSeries } from "./types.js";

interface ActionInputs {
  user: string;
  token: string;
  outputs: string[];
  targetBranch: string;
  commitMessage: string;
  repoSlug: string;
}

function readInputs(): ActionInputs {
  const user = required("INPUT_GITHUB_USER_NAME", "github_user_name");
  const token = required("INPUT_GITHUB_TOKEN", "github_token");
  const rawOutputs = process.env.INPUT_OUTPUTS || "contributions.svg";
  const outputs = rawOutputs
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"));
  const targetBranch = process.env.INPUT_TARGET_BRANCH || "output";
  const commitMessage = process.env.INPUT_COMMIT_MESSAGE || "chore: update contribution chart";

  // GITHUB_REPOSITORY is automatically provided to the action's container.
  const repoSlug = process.env.GITHUB_REPOSITORY;
  if (!repoSlug) throw new Error("GITHUB_REPOSITORY is not set");

  return { user, token, outputs, targetBranch, commitMessage, repoSlug };
}

function required(envKey: string, label: string): string {
  const v = process.env[envKey];
  if (!v) throw new Error(`Missing required input: ${label}`);
  return v;
}

async function main(): Promise<void> {
  const inputs = readInputs();

  if (inputs.outputs.length === 0) {
    throw new Error(
      "No output files specified. Set the `outputs` input to one or more file paths (one per line).",
    );
  }
  console.log(`Generating ${inputs.outputs.length} file(s) for @${inputs.user}`);

  // Parse all outputs first so we know the maximum period to fetch (we fetch
  // once at the largest range, then derive smaller windows in-memory).
  const parsed: ParsedOutput[] = inputs.outputs.map((line) => parseOutputLine(line, inputs.user));
  const maxPeriod = Math.max(...parsed.map((p) => p.options.period));

  // Clamp the lookup to the user's account creation date.
  const accountCreated = await fetchUserCreatedAt(inputs.user, inputs.token).catch((err) => {
    throw wrapGraphqlError(err, inputs.user);
  });
  const today = new Date();
  const earliest = new Date(`${accountCreated}T00:00:00Z`);
  const desiredFrom = new Date(today);
  desiredFrom.setUTCDate(desiredFrom.getUTCDate() - (maxPeriod - 1));
  const from = (desiredFrom < earliest ? earliest : desiredFrom).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  console.log(`Fetching contributions from ${from} to ${to}…`);
  const series = await fetchContributions(inputs.user, inputs.token, from, to).catch((err) => {
    throw wrapGraphqlError(err, inputs.user);
  });

  const files: Record<string, string> = {};
  for (const out of parsed) {
    const sub = sliceLastN(series, out.options.period);
    const bucketed = aggregate(sub, out.options.granularity, out.options.types);
    files[out.filePath] = renderSVG(bucketed, out.options);
    console.log(
      `  rendered ${out.filePath} (${out.options.style}, ${out.options.granularity}, ${bucketed.buckets.length} buckets)`,
    );
  }

  await pushFiles({
    files,
    repoSlug: inputs.repoSlug,
    branch: inputs.targetBranch,
    token: inputs.token,
    commitMessage: inputs.commitMessage,
  });

  console.log("Done.");
}

/** Translate common GraphQL errors into clearer messages. */
function wrapGraphqlError(err: unknown, user: string): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Could not resolve to a User/i.test(msg) || /NOT_FOUND/.test(msg)) {
    return new Error(`GitHub user "@${user}" not found. Check the github_user_name input.`);
  }
  if (/Bad credentials|401/i.test(msg)) {
    return new Error(
      "GitHub rejected the token (Bad credentials). Check that github_token is valid and not expired.",
    );
  }
  if (/insufficient|scope|403/i.test(msg)) {
    return new Error(
      "GitHub rejected the token (insufficient scope). For private contributions, use a Personal Access Token with the `repo` scope.",
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function sliceLastN(series: ContribSeries, n: number): ContribSeries {
  const daily = series.daily.slice(-n);
  return {
    user: series.user,
    from: daily[0]?.date ?? series.from,
    to: daily[daily.length - 1]?.date ?? series.to,
    daily,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
