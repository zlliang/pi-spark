import type { Usage } from "@earendil-works/pi-ai";
import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

/** Structural type guard for the pi `Usage` shape. */
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

/** Sum two `Usage` values into a new one. */
export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    totalTokens: a.totalTokens + b.totalTokens,
    cost: {
      input: a.cost.input + b.cost.input,
      output: a.cost.output + b.cost.output,
      cacheRead: a.cost.cacheRead + b.cost.cacheRead,
      cacheWrite: a.cost.cacheWrite + b.cost.cacheWrite,
      total: a.cost.total + b.cost.total,
    },
  };
}

/**
 * Extract usage from a session entry, classifying it as subscription or paid.
 *
 * `usage`/`provider`/`model` live in different fields depending on the entry type:
 *
 * - `message` carries them on `.message`
 * - `custom` on `.data`
 * - `custom_message` on `.details`.
 *
 * Other entry types carry no usage. Returns `undefined` when the resolved field has no `usage`.
 *
 * An entry counts as subscription only when its `provider`/`model` resolve to an OAuth model in the
 * registry; everything else (including entries without `provider`/`model`) is treated as paid.
 */
export function getEntryUsage(ctx: ExtensionContext, entry: SessionEntry): { type: "subscription" | "paid"; usage: Usage } | undefined {
  let source: unknown;
  if (entry.type === "message") source = entry.message;
  else if (entry.type === "custom") source = entry.data;
  else if (entry.type === "custom_message") source = entry.details;
  else return;

  if (typeof source !== "object" || source === null) return;
  const data = source as { usage?: unknown; provider?: unknown; model?: unknown };
  if (!isUsage(data.usage)) return;

  const type = isSubscription(ctx, data.provider, data.model) ? "subscription" : "paid";
  return { type, usage: data.usage };
}

function isSubscription(ctx: ExtensionContext, provider: unknown, model: unknown): boolean {
  if (typeof provider !== "string" || typeof model !== "string") return false;
  const resolved = ctx.modelRegistry.find(provider, model);
  return resolved ? ctx.modelRegistry.isUsingOAuth(resolved) : false;
}
