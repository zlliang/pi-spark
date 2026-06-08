import type { Theme } from "@earendil-works/pi-coding-agent";

import type { CodexUsage } from "./client";

const LABEL = "Codex";

/** Render a footer status string for normalized Codex usage. */
export function renderUsage(theme: Theme, usage: CodexUsage): string {
  const label = theme.fg("dim", LABEL);

  if (usage.unlimited || (usage.primaryPercent === undefined && usage.secondaryPercent === undefined)) {
    return `${label} ${theme.fg("success", "unlimited")}`;
  }

  const fiveHour = renderLane(theme, "5h", usage.primaryPercent);
  const sevenDay = renderLane(theme, "7d", usage.secondaryPercent);
  return `${label} ${fiveHour} ${sevenDay}`;
}

/** Render a footer status string for a usage fetch error. */
export function renderError(theme: Theme, message: string): string {
  return theme.fg("error", `${LABEL} usage unavailable: ${message}`);
}

function renderLane(theme: Theme, label: string, percent: number | undefined): string {
  const text = `${label} ${percent === undefined ? "?" : percent.toFixed(0)}%`;

  if (percent && percent > 90) return theme.fg("error", text);
  if (percent && percent > 70) return theme.fg("warning", text);
  return theme.fg("dim", text);
}
