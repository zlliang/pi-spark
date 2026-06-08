import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export const CODEX_PROVIDER = "openai-codex";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const REQUEST_TIMEOUT_MS = 30_000;

/** Normalized Codex usage with rate-limit windows reduced to used percentages. */
export interface CodexUsage {
  unlimited: boolean;
  /** Used percentage of the 5-hour window, clamped to 0-100. */
  primaryPercent: number | undefined;
  /** Used percentage of the 7-day window, clamped to 0-100. */
  secondaryPercent: number | undefined;
}

interface CodexUsageResponse {
  rate_limit?: {
    primary_window?: CodexRateWindow | null;
    secondary_window?: CodexRateWindow | null;
  } | null;
  credits?: {
    unlimited?: boolean;
  } | null;
}

interface CodexRateWindow {
  used_percent?: number | string;
}

/** Read the ChatGPT account id from the stored Codex OAuth credential, if present. */
export function readAccountId(ctx: ExtensionContext): string | undefined {
  const credential = ctx.modelRegistry.authStorage.get(CODEX_PROVIDER) as { accountId?: string } | undefined;
  const accountId = credential?.accountId;

  return typeof accountId === "string" && accountId.trim() ? accountId.trim() : undefined;
}

/** Fetch and normalize Codex usage, aborting on timeout or when the parent signal aborts. */
export async function fetchCodexUsage(token: string, accountId?: string, parentSignal?: AbortSignal): Promise<CodexUsage> {
  const signals = [AbortSignal.timeout(REQUEST_TIMEOUT_MS)];
  if (parentSignal) signals.push(parentSignal);

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;

  const response = await fetch(USAGE_URL, { method: "GET", headers, signal: AbortSignal.any(signals) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return normalizeUsage((await response.json()) as CodexUsageResponse);
}

function normalizeUsage(payload: CodexUsageResponse): CodexUsage {
  return {
    unlimited: payload.credits?.unlimited === true,
    primaryPercent: parseUsedPercent(payload.rate_limit?.primary_window),
    secondaryPercent: parseUsedPercent(payload.rate_limit?.secondary_window),
  };
}

function parseUsedPercent(window: CodexRateWindow | null | undefined): number | undefined {
  const raw = window?.used_percent;
  if (raw === undefined || raw === null) return undefined;

  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
}
