export interface ClipboardResult {
  success: boolean;
  error?: string;
}

export interface ClipboardProvider {
  /** Copies a PNG file at `imagePath` to the system clipboard. */
  copyImage(imagePath: string): Promise<ClipboardResult>;
  /** True only when this provider's tools/runtime are available. */
  isAvailable(): Promise<boolean>;
  /** Display name for diagnostics. */
  name: string;
}

export const DEFAULT_TIMEOUT_MS = 3000;
