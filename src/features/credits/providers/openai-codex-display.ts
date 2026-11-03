import type { CodexDisplay } from "../config";
import type { CreditsLane } from "../types";

/** Selects Codex usage and spend information, falling back when a preferred source is absent. */
export function selectCodexLanes(
  windowLanes: CreditsLane[],
  spendLane: CreditsLane | undefined,
  display: CodexDisplay = "both",
): CreditsLane[] {
  const spendLanes = spendLane ? [spendLane] : [];

  if (display === "rate-limits") return windowLanes.length > 0 ? windowLanes : spendLanes;
  if (display === "spend") return spendLane ? spendLanes : windowLanes;

  return [...windowLanes, ...spendLanes];
}
