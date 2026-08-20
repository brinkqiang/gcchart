import type { ContribType, Granularity, RenderOptions, Style, Theme } from "./types.js";
import { ALL_TYPES } from "./types.js";
import { autoGranularity } from "./aggregate.js";

const STYLES: Style[] = ["sketchy", "clean"];
const THEMES: Theme[] = ["auto", "light", "dark"];
const GRANS: Granularity[] = ["day", "week", "month"];

/** Cap period at 20 years to bound the GraphQL query count and prevent abuse. */
const MAX_PERIOD_DAYS = 20 * 365;

export interface ParsedOutput {
  /** File path inside target_branch (e.g. "contributions.svg"). */
  filePath: string;
  options: RenderOptions;
}

/**
 * Parses one line of the `outputs:` input - a path optionally followed by a
 * query string (`name.svg?period=90&style=clean`). Falls back to defaults for
 * any option not provided. Throws if the file path is unsafe (absolute or
 * contains parent-directory traversal).
 */
export function parseOutputLine(line: string, user: string): ParsedOutput {
  const [rawPath, qs] = line.split("?");
  const filePath = rawPath.trim();
  validatePath(filePath);

  const params = qs ? new URLSearchParams(qs) : new URLSearchParams();

  const period = clampInt(params.get("period"), 1, MAX_PERIOD_DAYS, 365);
  const granularity = pickEnum(params.get("granularity"), GRANS, "auto" as Granularity | "auto");
  const cumulative = pickBool(params.get("cumulative"), true);
  const style = pickEnum(params.get("style"), STYLES, "sketchy" as Style);
  const theme = pickEnum(params.get("theme"), THEMES, "auto" as Theme);
  const types = parseTypes(params.get("types"));

  const resolvedGran: Granularity = granularity === "auto" ? autoGranularity(period) : granularity;

  return {
    filePath,
    options: { period, granularity: resolvedGran, cumulative, style, theme, types, user },
  };
}

/** Reject empty paths, absolute paths, and any segment of "..". */
function validatePath(p: string): void {
  if (!p) throw new Error("outputs: empty file path");
  if (p.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(p)) {
    throw new Error(`outputs: absolute paths are not allowed (got "${p}")`);
  }
  const segments = p.split(/[\\/]+/);
  if (segments.some((s) => s === "..")) {
    throw new Error(`outputs: path may not contain ".." segments (got "${p}")`);
  }
}

function clampInt(raw: string | null, min: number, max: number, def: number): number {
  if (raw == null) return def;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

function pickEnum<T extends string>(raw: string | null, values: T[], def: T): T {
  if (raw && (values as string[]).includes(raw)) return raw as T;
  return def;
}

function pickBool(raw: string | null, def: boolean): boolean {
  if (raw == null) return def;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return def;
}

function parseTypes(raw: string | null): ContribType[] {
  if (!raw) return [...ALL_TYPES];
  const parts = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as ContribType[];
  const seen = new Set<ContribType>();
  for (const p of parts) {
    if ((ALL_TYPES as readonly string[]).includes(p)) seen.add(p);
  }
  return seen.size ? [...seen] : [...ALL_TYPES];
}
