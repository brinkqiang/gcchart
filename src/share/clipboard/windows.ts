import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ClipboardProvider, ClipboardResult } from "./types.js";
import { DEFAULT_TIMEOUT_MS } from "./types.js";

const exec = promisify(execFile);

const isWSL = !!process.env.WSL_DISTRO_NAME;

/** Translate a Linux path (e.g. /tmp/foo.png) to its Windows equivalent
 *  (e.g. \\wsl.localhost\Ubuntu\tmp\foo.png) so that PowerShell can read it. */
async function toWindowsPath(linuxPath: string): Promise<string> {
  const { stdout } = await exec("wslpath", ["-w", linuxPath]);
  return stdout.trim();
}

export const windowsProvider: ClipboardProvider = {
  name: isWSL ? "Windows (via WSL)" : "Windows",

  async isAvailable(): Promise<boolean> {
    return process.platform === "win32" || isWSL;
  },

  async copyImage(imagePath: string): Promise<ClipboardResult> {
    let winPath: string;
    try {
      winPath = isWSL ? await toWindowsPath(imagePath) : imagePath;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? `wslpath failed: ${err.message}` : "wslpath failed",
      };
    }

    // PowerShell string literals treat backslashes as ordinary characters,
    // so we don't need to escape them - only quote-escape any embedded `"`.
    const safePath = winPath.replace(/"/g, '`"');
    const script =
      `Add-Type -AssemblyName System.Windows.Forms;` +
      `Add-Type -AssemblyName System.Drawing;` +
      `try{` +
      `$img=[System.Drawing.Image]::FromFile("${safePath}");` +
      `[System.Windows.Forms.Clipboard]::SetImage($img);` +
      `$img.Dispose();exit 0` +
      `}catch{Write-Error $_.Exception.Message;exit 1}`;

    return new Promise((resolve) => {
      const proc = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
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
        else resolve({ success: false, error: stderr.trim() || `powershell.exe exited with code ${code}` });
      });
    });
  },
};
