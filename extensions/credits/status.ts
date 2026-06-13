import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Credits, CreditsLane } from "./types";

const WINDOWS_WARNING = 70;
const WINDOWS_ERROR = 90;
const BALANCE_WARNING = 10;
const BALANCE_ERROR = 5;

export function renderCredits(theme: Theme, label: string, credits: Credits): string {
  const styledLabel = theme.fg("dim", label);

  if (credits.type === "windows") return `${styledLabel} ${renderWindows(theme, credits)}`;
  return `${styledLabel} ${renderBalance(theme, credits)}`;
}

export function renderError(theme: Theme, label: string, message: string): string {
  return theme.fg("error", `${label} credits unavailable: ${message}`);
}

function renderWindows(theme: Theme, credits: Extract<Credits, { type: "windows" }>): string {
  const unlimited = credits.unlimited || credits.lanes.every((lane) => lane.percent === undefined);
  if (unlimited) return theme.fg("success", "unlimited");

  return credits.lanes.map((lane) => renderLane(theme, lane)).join(" ");
}

function renderLane(theme: Theme, lane: CreditsLane): string {
  const text = `${lane.label} ${lane.percent === undefined ? "?" : lane.percent.toFixed(0)}%`;

  if (lane.percent && lane.percent > WINDOWS_ERROR) return theme.fg("error", text);
  if (lane.percent && lane.percent > WINDOWS_WARNING) return theme.fg("warning", text);
  return theme.fg("success", text);
}

function renderBalance(theme: Theme, credits: Extract<Credits, { type: "balance" }>): string {
  if (credits.remaining === undefined) return theme.fg("dim", "$?");

  const text = `$${credits.remaining.toFixed(2)}`;

  if (credits.remaining < BALANCE_ERROR) return theme.fg("error", text);
  if (credits.remaining < BALANCE_WARNING) return theme.fg("warning", text);
  return theme.fg("success", text);
}
