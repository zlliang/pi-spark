import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getCapabilities, hyperlink } from "@earendil-works/pi-tui";

import type { Theme } from "@earendil-works/pi-coding-agent";

export function renderPath(path: string | null, cwd: string, theme: Theme): string {
  if (path === null) return theme.fg("error", "[invalid arg]");
  if (!path) return theme.fg("toolOutput", "...");

  const home = homedir();
  const displayPath = path.startsWith(home) ? `~${path.slice(home.length)}` : path;
  const styledPath = theme.fg("accent", displayPath);
  if (!getCapabilities().hyperlinks) return styledPath;

  return hyperlink(styledPath, pathToFileURL(resolvePath(path, cwd)).href);
}

function resolvePath(path: string, cwd: string): string {
  const normalizedPath = normalizePath(path);
  const normalizedCwd = normalizePath(cwd);
  return isAbsolute(normalizedPath) ? resolve(normalizedPath) : resolve(normalizedCwd, normalizedPath);
}

function normalizePath(path: string): string {
  const home = homedir();
  if (path === "~") return home;
  if (path.startsWith("~/") || (process.platform === "win32" && path.startsWith("~\\"))) {
    return join(home, path.slice(2));
  }
  return path.startsWith("file://") ? fileURLToPath(path) : path;
}
