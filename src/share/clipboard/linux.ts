import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createReadStream } from "node:fs";
import type { ClipboardProvider, ClipboardResult } from "./types.js";
import { DEFAULT_TIMEOUT_MS } from "./types.js";

interface LinuxTool {
  cmd: string;
  args: (imagePath: string) => string[];
  /** Whether the image data must be piped via stdin (vs. passed as a file path). */
  usesStdin: boolean;
  name: string;
}

// Wayland first, then X11 fallbacks.
const TOOLS: LinuxTool[] = [
  { cmd: "wl-copy", args: () => ["--type", "image/png"], usesStdin: true, name: "wl-copy (Wayland)" },
  {
    cmd: "xclip",
    args: (p) => ["-selection", "clipboard", "-t", "image/png", "-i", p],
    usesStdin: false,
    name: "xclip (X11)",
  },
  { cmd: "xsel", args: () => ["--clipboard", "--input", "--type", "image/png"], usesStdin: true, name: "xsel (X11)" },
];

const whichCache = new Map<string, boolean>();

async function cmdExists(cmd: string): Promise<boolean> {
  const cached = whichCache.get(cmd);
  if (cached !== undefined) return cached;
  const exists = await new Promise<boolean>((resolve) => {
    const p = spawn("which", [cmd], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
  whichCache.set(cmd, exists);
  return exists;
}

function runTool(tool: LinuxTool, imagePath: string): Promise<ClipboardResult> {
  return new Promise((resolve) => {
    const args = tool.args(imagePath);
    const proc = spawn(tool.cmd, args, {
      stdio: [tool.usesStdin ? "pipe" : "ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => proc.kill("SIGKILL"), DEFAULT_TIMEOUT_MS);
    let stderr = "";
    proc.stderr?.on("data", (d) => (stderr += d.toString()));

    if (tool.usesStdin && proc.stdin && existsSync(imagePath)) {
      createReadStream(imagePath).pipe(proc.stdin);
    }

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: stderr.trim() || `${tool.cmd} exited with code ${code}` });
    });
  });
}

export const linuxProvider: ClipboardProvider = {
  name: "Linux",

  async isAvailable(): Promise<boolean> {
    if (process.platform !== "linux") return false;
    // WSL is detected & handled by the Windows provider (it uses the host
    // PowerShell clipboard so the image lands on Windows, not the Linux side).
    if (process.env.WSL_DISTRO_NAME) return false;
    for (const t of TOOLS) {
      if (await cmdExists(t.cmd)) return true;
    }
    return false;
  },

  async copyImage(imagePath: string): Promise<ClipboardResult> {
    const tried: string[] = [];
    for (const tool of TOOLS) {
      if (!(await cmdExists(tool.cmd))) continue;
      tried.push(tool.name);
      const r = await runTool(tool, imagePath);
      if (r.success) return r;
    }
    if (tried.length === 0) {
      return {
        success: false,
        error: "No clipboard tool found. Install wl-clipboard (Wayland) or xclip/xsel (X11).",
      };
    }
    return { success: false, error: `Clipboard copy failed. Tried: ${tried.join(", ")}` };
  },
};
