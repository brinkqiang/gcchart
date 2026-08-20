/**
 * Standalone CLI for one-shot SVG generation. Distributed via npm so users can
 * run `npx gcchart` without cloning the repo. Reads real data from the GitHub
 * GraphQL API, writes every variant + an interactive preview page to a local
 * output directory, then optionally walks the user through sharing one of the
 * variants on X (Twitter) with the image pre-loaded into the clipboard.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import { fetchContributions, fetchUserCreatedAt } from "./github.js";
import { renderAllVariants, buildPreviewHtml, VARIANTS } from "./preview.js";
import { runShareFlow } from "./share/index.js";

interface CliArgs {
  token: string;
  user: string;
  outDir: string;
  noShare: boolean;
}

const HELP = `
Usage:
  npx gcchart [options]

Options:
  -t, --token <token>     GitHub token (or GITHUB_TOKEN env, or prompt)
  -u, --user  <username>  GitHub username (or GITHUB_USER env, or prompt)
  -o, --out   <dir>       Output directory (default: ./contribution-chart)
      --no-share          Skip the "share to X" prompt at the end
  -h, --help              Show this help
  -v, --version           Show version

If --token / --user are omitted and the corresponding env vars aren't set,
they're requested interactively (the token prompt is hidden - it won't
appear in your shell history). In non-TTY environments (CI, pipes) you must
supply both via flag or env var.

Get a token at https://github.com/settings/tokens (classic):
  - read:user            public contributions only
  - read:user + repo     public + private contributions (also requires the
                         "Include private contributions on my profile" toggle
                         in your GitHub profile settings)

Example:
  GITHUB_TOKEN=ghp_xxx GITHUB_USER=your-name npx gcchart
  npx gcchart -t ghp_xxx -u your-name -o ./out
`.trim();

function parseArgs(argv: string[]): { args: Partial<CliArgs>; help?: boolean; version?: boolean } {
  const out: Partial<CliArgs> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v == null || v.startsWith("-")) {
        console.error(`Missing value for ${a}`);
        process.exit(2);
      }
      i++;
      return v;
    };
    switch (a) {
      case "-h":
      case "--help":
        return { args: out, help: true };
      case "-v":
      case "--version":
        return { args: out, version: true };
      case "-t":
      case "--token":
        out.token = next();
        break;
      case "-u":
      case "--user":
        out.user = next();
        break;
      case "-o":
      case "--out":
        out.outDir = next();
        break;
      case "--no-share":
        out.noShare = true;
        break;
      default:
        console.error(`Unknown option: ${a}`);
        console.error(HELP);
        process.exit(2);
    }
  }
  return { args: out };
}

/**
 * Resolves the GitHub token and username, prompting interactively for any that
 * weren't supplied via flag/env. The token prompt is hidden (no echo, no shell
 * history). In non-TTY environments we keep the old fail-fast behaviour because
 * prompts can't run there (CI, pipes, etc.).
 */
async function resolveCredentials(initial: {
  token: string | undefined;
  user: string | undefined;
}): Promise<{ token: string; user: string }> {
  let { token, user } = initial;

  if (!token || !user) {
    if (!process.stdout.isTTY) {
      p.log.error(
        "Both GITHUB_TOKEN and GITHUB_USER (or --token / --user) are required when stdin is not a TTY.",
      );
      process.exit(1);
    }
  }

  if (!user) {
    const answer = await p.text({
      message: "GitHub username:",
      placeholder: "your-handle",
      // GitHub username rules: alphanumeric + hyphens, no leading/trailing
      // hyphen, no consecutive hyphens, max 39 chars. Pre-validate so we
      // fail fast instead of bouncing off the GraphQL API.
      validate: (v) => {
        const t = v?.trim();
        if (!t) return "Required.";
        if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(t)) {
          return "Invalid GitHub username (alphanumeric + non-consecutive hyphens, max 39 chars).";
        }
        return undefined;
      },
    });
    if (p.isCancel(answer)) {
      p.cancel("Cancelled.");
      process.exit(1);
    }
    user = answer.trim();
  }

  if (!token) {
    p.log.info(
      "Need a GitHub token. Create one at https://github.com/settings/tokens (classic):\n" +
        "  • read:user           public contributions\n" +
        "  • read:user + repo    + private contributions",
    );
    const answer = await p.password({
      message: "Paste your GitHub token:",
      validate: (v) => {
        if (!v) return "Required.";
        if (v.length < 20) return "Token looks too short.";
        return undefined;
      },
    });
    if (p.isCancel(answer)) {
      p.cancel("Cancelled.");
      process.exit(1);
    }
    token = answer;
  }

  return { token, user };
}

async function readPackageVersion(): Promise<string> {
  try {
    const url = new URL("../package.json", import.meta.url);
    const { readFile } = await import("node:fs/promises");
    const pkg = JSON.parse(await readFile(url, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    console.log(HELP);
    return;
  }
  if (parsed.version) {
    console.log(await readPackageVersion());
    return;
  }

  const outDir = path.resolve(process.cwd(), parsed.args.outDir ?? "contribution-chart");

  p.intro("gcchart");

  const { token, user } = await resolveCredentials({
    token: parsed.args.token ?? process.env.GITHUB_TOKEN,
    user: parsed.args.user ?? process.env.GITHUB_USER,
  });

  p.log.step(`Fetching contributions for @${user}…`);

  const created = await fetchUserCreatedAt(user, token);
  p.log.info(`Account created on ${created}`);

  const maxPeriod = Math.max(...VARIANTS.map((v) => v.period));
  const today = new Date();
  const earliest = new Date(`${created}T00:00:00Z`);
  const desiredFrom = new Date(today);
  desiredFrom.setUTCDate(desiredFrom.getUTCDate() - (maxPeriod - 1));
  const from = (desiredFrom < earliest ? earliest : desiredFrom).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  p.log.info(`Range: ${from} → ${to} (${maxPeriod} days max)`);
  const series = await fetchContributions(user, token, from, to);
  const total = series.daily.reduce((a, d) => a + d.commit + d.pr + d.issue + d.review, 0);
  p.log.success(`Fetched ${series.daily.length} days, ${total.toLocaleString("en-US")} contributions.`);

  await mkdir(outDir, { recursive: true });
  const variantBuckets = await renderAllVariants(series, outDir, user);
  const html = buildPreviewHtml(`gcchart / @${user}`, user, series, variantBuckets);
  await writeFile(path.join(outDir, "index.html"), html, "utf8");
  p.log.success(`Wrote ${VARIANTS.length * 2} SVGs + index.html to ${outDir}`);

  // Skip the share prompt entirely if --no-share or non-TTY (CI / piped use).
  const interactive = process.stdout.isTTY && !parsed.args.noShare;
  if (!interactive) {
    p.outro(`Open ${path.join(outDir, "index.html")} in a browser to preview.`);
    return;
  }

  const wantShare = await p.confirm({
    message: "Share one of these on X (Twitter)?",
    initialValue: true,
  });
  if (p.isCancel(wantShare) || !wantShare) {
    p.outro(`Open ${path.join(outDir, "index.html")} in a browser to preview.`);
    return;
  }

  await runShareFlow({ series, outDir });
  p.outro("Done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
