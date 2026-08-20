import { spawn } from "node:child_process";
import type { ClipboardProvider, ClipboardResult } from "./types.js";
import { DEFAULT_TIMEOUT_MS } from "./types.js";

export const macOSProvider: ClipboardProvider = {
  name: "macOS (osascript)",

  async isAvailable(): Promise<boolean> {
    return process.platform === "darwin";
  },

  async copyImage(imagePath: string): Promise<ClipboardResult> {
    // AppleScript to copy a PNG file to clipboard. The «class PNGf» token tells
    // the clipboard manager to register the data as a PNG image rather than a
    // file reference, so X / browsers can paste it as an inline image.
    const script = `set the clipboard to (read POSIX file "${imagePath}" as «class PNGf»)`;
    return runWithTimeout("osascript", ["-e", script]);
  },
};

function runWithTimeout(cmd: string, args: string[]): Promise<ClipboardResult> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => proc.kill("SIGKILL"), DEFAULT_TIMEOUT_MS);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: stderr.trim() || `${cmd} exited with code ${code}` });
    });
  });
}
