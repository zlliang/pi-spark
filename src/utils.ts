import type { Usage } from "@earendil-works/pi-ai";

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

export function toNumber(value?: string | number | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
