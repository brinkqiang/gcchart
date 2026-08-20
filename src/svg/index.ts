import type { BucketSeries, RenderOptions } from "../types.js";
import { renderSketchy } from "./sketchy.js";
import { renderClean } from "./clean.js";

export function renderSVG(series: BucketSeries, opts: RenderOptions): string {
  return opts.style === "clean" ? renderClean(series, opts) : renderSketchy(series, opts);
}
