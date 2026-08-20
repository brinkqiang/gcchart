import { spawn } from "node:child_process";

/** Opens the given URL in the user's default browser.
 *  Returns true if the launch command was issued successfully. */
export async function openUrl(url: string): Promise<boolean> {
  const platform = process.platform;
  const isWSL = !!process.env.WSL_DISTRO_NAME;

  // Pick the right launcher for the host OS. Under WSL we want the Windows
  // browser (so the X intent opens where the user can sign in & paste).
  let cmd: string;
  let args: string[];
  if (isWSL) {
    // PowerShell's Start-Process handles URLs reliably under WSL.
    cmd = "powershell.exe";
    args = ["-NoProfile", "-Command", `Start-Process "${url}"`];
  } else if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    cmd = "cmd";
    // `cmd /c start "" "url"` - the empty "" is a window title, required when
    // the URL itself contains an unquoted argument.
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }

  return new Promise((resolve) => {
    try {
      const proc = spawn(cmd, args, { stdio: "ignore", detached: true });
      proc.on("error", () => resolve(false));
      proc.unref();
      // Don't await exit - many launchers fork the actual browser and exit
      // immediately, others stay attached. Resolve optimistically; failure
      // shows up via the error event above.
      setTimeout(() => resolve(true), 100);
    } catch {
      resolve(false);
    }
  });
}
