import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Credits, CreditsProvider } from "../types";

const PROVIDER = "openai-codex";
const URL = "https://chatgpt.com/backend-api/wham/usage";

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

export function getAccountId(ctx: ExtensionContext): string | undefined {
  const credential = ctx.modelRegistry.authStorage.get(PROVIDER) as { accountId?: string } | undefined;
  const accountId = credential?.accountId;

  return typeof accountId === "string" && accountId.trim() ? accountId.trim() : undefined;
}

function parseUsedPercent(window: CodexRateWindow | null | undefined): number | undefined {
  const raw = window?.used_percent;
  if (raw === undefined || raw === null) return undefined;

  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
}

export const openaiCodexProvider: CreditsProvider = {
  provider: PROVIDER,
  label: "Codex",

  async fetch(ctx, apiKey, signal): Promise<Credits> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const accountId = getAccountId(ctx);
    if (accountId) headers["ChatGPT-Account-Id"] = accountId;

    const response = await fetch(URL, { headers, signal });
    if (!response.ok) throw new Error("request failed");

    const payload = (await response.json()) as CodexUsageResponse;

    return {
      type: "windows",
      unlimited: payload.credits?.unlimited === true,
      lanes: [
        { label: "5h", percent: parseUsedPercent(payload.rate_limit?.primary_window) },
        { label: "7d", percent: parseUsedPercent(payload.rate_limit?.secondary_window) },
      ],
    };
  },
};
