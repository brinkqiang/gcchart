import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const exec = promisify(execFile);

/** Replace any occurrence of `secret` in a string with "***". Defensive: handles
 *  empty/missing inputs without throwing. */
function redact(s: unknown, secret: string): string {
  if (typeof s !== "string" || !secret) return typeof s === "string" ? s : "";
  return s.split(secret).join("***");
}

export interface PushArgs {
  /** Files to commit, keyed by their target path inside the branch. */
  files: Record<string, string>;
  repoSlug: string; // e.g. "pipipi-dev/pipipi-dev"
  branch: string;
  token: string;
  commitMessage: string;
  authorName?: string;
  authorEmail?: string;
}

/**
 * Commits a set of files to a target branch, creating the branch as an orphan
 * (or fast-forwarding it) so we don't carry the main repo's history with us.
 * The implementation mirrors the snk approach: clone the branch into a temp
 * directory, write files, commit, push.
 */
export async function pushFiles(args: PushArgs): Promise<void> {
  try {
    await pushFilesImpl(args);
  } catch (e: unknown) {
    // Redact the token from message AND stack/stderr - execFile errors can
    // include the offending command (which contains the remote URL with the
    // token embedded) on properties beyond `message`.
    if (e instanceof Error && args.token) {
      e.message = redact(e.message, args.token);
      if (e.stack) e.stack = redact(e.stack, args.token);
      const anyErr = e as { stderr?: unknown; stdout?: unknown; cmd?: unknown };
      if (anyErr.stderr) anyErr.stderr = redact(anyErr.stderr, args.token);
      if (anyErr.stdout) anyErr.stdout = redact(anyErr.stdout, args.token);
      if (anyErr.cmd)    anyErr.cmd    = redact(anyErr.cmd, args.token);
    }
    throw e;
  }
}

async function pushFilesImpl(args: PushArgs): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "gcb-"));
  try {
    await pushFilesIn(dir, args);
  } finally {
    // Always remove the temp clone so the token-bearing remote URL in
    // .git/config doesn't linger on disk after the run completes.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function pushFilesIn(dir: string, args: PushArgs): Promise<void> {
  const remote = `https://x-access-token:${args.token}@github.com/${args.repoSlug}.git`;
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

  const run = (cmd: string, ...rest: string[]) => exec("git", [cmd, ...rest], { cwd: dir, env });

  await exec("git", ["init", "-q"], { cwd: dir, env });
  await run("config", "user.name", args.authorName || "gcchart[bot]");
  await run("config", "user.email", args.authorEmail || "gcchart@users.noreply.github.com");
  await run("remote", "add", "origin", remote);

  // Try to fetch the target branch. If it doesn't exist, start as an orphan.
  let branchExists = true;
  try {
    await exec("git", ["fetch", "--depth=1", "origin", args.branch], { cwd: dir, env });
  } catch {
    branchExists = false;
  }

  if (branchExists) {
    await run("checkout", args.branch);
  } else {
    await run("checkout", "--orphan", args.branch);
  }

  // Clean working tree (orphan branch may have files from initial clone state).
  try {
    await exec("git", ["rm", "-rf", "--ignore-unmatch", "."], { cwd: dir, env });
  } catch {
    /* empty branch - nothing to remove */
  }

  // Write all files
  for (const [relPath, contents] of Object.entries(args.files)) {
    const full = path.join(dir, relPath);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, contents, "utf8");
    await exec("git", ["add", "--", relPath], { cwd: dir, env });
  }

  // Skip if nothing changed
  const status = await exec("git", ["status", "--porcelain"], { cwd: dir, env });
  if (!status.stdout.trim()) {
    console.log("No changes to commit.");
    return;
  }

  await run("commit", "-m", args.commitMessage);
  await exec("git", ["push", "--force", "origin", `HEAD:${args.branch}`], { cwd: dir, env });
  const fileCount = Object.keys(args.files).length;
  console.log(`Pushed ${fileCount} file(s) to ${args.repoSlug}#${args.branch}`);
}
