import type { Usage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

/** Structural type guard for the Pi `Usage` shape. */
export function isUsage(value: unknown): value is Usage {
  if (typeof value !== "object" || value === null) return false;

  const usage = value as Record<string, unknown>;
  const hasTokenFields =
    typeof usage.input === "number" &&
    typeof usage.output === "number" &&
    typeof usage.cacheRead === "number" &&
    typeof usage.cacheWrite === "number" &&
    typeof usage.totalTokens === "number";
  if (!hasTokenFields) return false;

  if (typeof usage.cost !== "object" || usage.cost === null) return false;
  const cost = usage.cost as Record<string, unknown>;
  return (
    typeof cost.input === "number" &&
    typeof cost.output === "number" &&
    typeof cost.cacheRead === "number" &&
    typeof cost.cacheWrite === "number" &&
    typeof cost.total === "number"
  );
}

/**
 * Extract usage from a session entry.
 *
 * `usage` live in different fields depending on the entry type:
 *
 * - `message` carries them on `message`.
 * - `custom` on `data`.
 * - `custom_message` on `details`.
 * - `compaction` and `branch_summary` directly on the entry.
 *
 * Other entry types carry no usage. Returns `undefined` when the resolved field has no `usage`.
 */
export function getEntryUsage(entry: SessionEntry): Usage | undefined {
  let source: unknown;
  if (entry.type === "message") source = entry.message;
  else if (entry.type === "custom") source = entry.data;
  else if (entry.type === "custom_message") source = entry.details;
  else if (entry.type === "compaction" || entry.type === "branch_summary") source = entry;
  else return;

  if (typeof source !== "object" || source === null) return;
  const data = source as { usage?: unknown };
  if (!isUsage(data.usage)) return;

  return data.usage;
}
