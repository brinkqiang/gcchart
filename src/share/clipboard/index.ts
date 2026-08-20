import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, unlink } from "node:fs/promises";
import { macOSProvider } from "./macos.js";
import { linuxProvider } from "./linux.js";
import { windowsProvider } from "./windows.js";
import type { ClipboardProvider, ClipboardResult } from "./types.js";

export type { ClipboardResult };

/** Order matters: WSL is detected by both Linux and Windows; Windows wins so
 *  the image lands on the host clipboard rather than the X server inside WSL. */
const PROVIDERS: ClipboardProvider[] = [windowsProvider, macOSProvider, linuxProvider];

async function pickProvider(): Promise<ClipboardProvider | null> {
  for (const p of PROVIDERS) {
    if (await p.isAvailable()) return p;
  }
  return null;
}

/**
 * Copies a PNG buffer to the system clipboard so it can be pasted into the
 * X (Twitter) post composer (or anywhere else) with Ctrl+V / Cmd+V.
 *
 * Internally writes to a temp file because most CLI clipboard tools handle
 * file paths more reliably than piped binary data.
 */
export async function copyPngToClipboard(png: Buffer, filename: string): Promise<ClipboardResult> {
  const provider = await pickProvider();
  if (!provider) {
    return { success: false, error: noProviderError() };
  }

  const tempPath = join(tmpdir(), filename);
  try {
    await writeFile(tempPath, png);
    return await provider.copyImage(tempPath);
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

function noProviderError(): string {
  if (process.platform === "linux") {
    return "No clipboard tool found. Install wl-clipboard (Wayland) or xclip/xsel (X11).";
  }
  return `Clipboard not supported on platform: ${process.platform}`;
}
