import { uuidv7 } from "@earendil-works/pi-agent-core";
import { readStoredCredential } from "@earendil-works/pi-coding-agent";
import prettyMilliseconds from "pretty-ms";

import { confirmCodexReset, formatAvailableResets, showCodexResetLoader, showCodexResetSelector } from "./openai-codex-panel";
import { toNumber } from "../../../utils/format";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CodexResetPanelData } from "./openai-codex-panel";
import type { Credits, CreditsLane, CreditsProvider, RefreshCredits } from "../types";

const PROVIDER = "openai-codex";
const BASE_URL = "https://chatgpt.com/backend-api";
const USAGE_PATH = "/wham/usage";
const RESET_CREDITS_PATH = "/wham/rate-limit-reset-credits";
const CONSUME_RESET_PATH = "/wham/rate-limit-reset-credits/consume";
const REQUEST_TIMEOUT_MS = 30_000;

interface CodexUsageResponse {
  rate_limit?: {
    primary_window?: CodexRateWindow | null;
    secondary_window?: CodexRateWindow | null;
  } | null;
  rate_limit_reset_credits?: { available_count: number } | null;
  credits?: { unlimited?: boolean } | null;
}

interface CodexRateWindow {
  limit_window_seconds: number;
  used_percent?: number | string;
}

export interface BankedRateLimitReset {
  id: string;
  status: string;
  granted_at: string;
  expires_at: string | null;
  title?: string | null;
  description?: string | null;
}

export interface RateLimitResetCreditsResponse {
  credits: BankedRateLimitReset[];
  available_count: number;
}

interface ConsumeResetResponse {
  code: "reset" | "nothing_to_reset" | "no_credit" | "already_redeemed";
  windows_reset: number;
}

async function runCodexReset(ctx: ExtensionContext, refresh: RefreshCredits): Promise<void> {
  const apiKey = await ctx.modelRegistry.getApiKeyForProvider(PROVIDER);
  if (!apiKey) return;

  const headers = buildHeaders(apiKey);

  const credit = await showCodexResetSelector(ctx, async (signal) => {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
    const [usage, details] = await Promise.all([fetchUsage(headers, requestSignal), fetchResetCredits(headers, requestSignal)]);

    return {
      ...details,
      usage: toCredits(usage, `· ${formatAvailableResets(details.available_count)}`),
    } satisfies CodexResetPanelData;
  });
  if (!credit || !(await confirmCodexReset(ctx, credit))) return;

  await redeemReset(ctx, headers, credit, refresh);
}

async function redeemReset(ctx: ExtensionContext, headers: Record<string, string>, credit: BankedRateLimitReset, refresh: RefreshCredits): Promise<void> {
  await showCodexResetLoader(ctx, async () => {
    const response = await consumeReset(headers, uuidv7(), credit.id);
    if (response.code === "nothing_to_reset") throw new Error("No Codex rate-limit window currently needs a reset");
    if (response.code === "no_credit") throw new Error("No Codex resets are available");
  }).finally(() => refresh(ctx));
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const credential = readStoredCredential(PROVIDER);
  const accountId = credential?.type === "oauth" ? credential.accountId : undefined;
  if (typeof accountId === "string" && accountId.length > 0) headers["ChatGPT-Account-ID"] = accountId;

  return headers;
}

async function requestJson<T>(path: string, headers: Record<string, string>, signal: AbortSignal, init: RequestInit = {}): Promise<T> {
  const requestHeaders = new Headers(headers);
  new Headers(init.headers).forEach((value, key) => requestHeaders.set(key, value));

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: requestHeaders,
    signal,
  });
  if (!response.ok) throw new Error(`Codex backend returned ${response.status}`);

  return (await response.json()) as T;
}

async function fetchUsage(headers: Record<string, string>, signal: AbortSignal): Promise<CodexUsageResponse> {
  return requestJson<CodexUsageResponse>(USAGE_PATH, headers, signal);
}

async function fetchResetCredits(headers: Record<string, string>, signal: AbortSignal): Promise<RateLimitResetCreditsResponse> {
  return requestJson<RateLimitResetCreditsResponse>(RESET_CREDITS_PATH, headers, signal);
}

async function consumeReset(headers: Record<string, string>, redeemRequestId: string, creditId: string): Promise<ConsumeResetResponse> {
  return requestJson<ConsumeResetResponse>(
    CONSUME_RESET_PATH,
    headers,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redeem_request_id: redeemRequestId, credit_id: creditId }),
    },
  );
}

function toCredits(usage: CodexUsageResponse, suffix?: string): Credits {
  return {
    type: "windows",
    unlimited: usage.credits?.unlimited === true,
    lanes: [usage.rate_limit?.primary_window, usage.rate_limit?.secondary_window]
      .filter((window): window is CodexRateWindow => window != null)
      .map(toLane),
    suffix,
  };
}

function toLane(window: CodexRateWindow): CreditsLane {
  return {
    label: prettyMilliseconds(window.limit_window_seconds * 1_000, { compact: true }),
    percent: parseUsedPercent(window),
  };
}

function parseUsedPercent(window?: CodexRateWindow | null): number | undefined {
  const value = toNumber(window?.used_percent);
  return value === undefined ? undefined : Math.min(100, Math.max(0, value));
}

export const openaiCodexProvider: CreditsProvider = {
  id: PROVIDER,
  label: "Codex",

  async fetch(apiKey, signal): Promise<Credits> {
    const headers = buildHeaders(apiKey);
    const usage = await fetchUsage(headers, signal);
    const availableCount = usage.rate_limit_reset_credits?.available_count ?? 0;
    const suffix = availableCount > 0 ? `(${formatAvailableResets(availableCount)})` : undefined;

    return toCredits(usage, suffix);
  },

  register(pi, _ctx, refresh): void {
    if (readStoredCredential(PROVIDER)?.type !== "oauth") return;

    pi.registerCommand("codex-reset", {
      description: "Select and redeem a banked OpenAI Codex rate-limit reset",
      handler: async (_args, ctx) => await runCodexReset(ctx, refresh),
    });
  },
};
