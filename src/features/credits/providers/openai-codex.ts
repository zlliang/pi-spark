import { uuidv7 } from "@earendil-works/pi-agent-core";
import { readStoredCredential } from "@earendil-works/pi-coding-agent";
import prettyMilliseconds from "pretty-ms";

import { confirmCodexReset, formatAvailableResets, showCodexResetLoader, showCodexResetSelector } from "./openai-codex-panel";
import { getAuthToken } from "../../../utils/auth";
import { toNumber } from "../../../utils/format";
import { http, withAuth } from "../../../utils/http";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { KyInstance } from "ky";
import type { CodexResetPanelData } from "./openai-codex-panel";
import type { Credits, CreditsLane, CreditsProvider, RefreshCredits } from "../types";

const PROVIDER = "openai-codex";
const BASE_URL = "https://chatgpt.com/backend-api";
const USAGE_PATH = "/wham/usage";
const RESET_CREDITS_PATH = "/wham/rate-limit-reset-credits";
const CONSUME_RESET_PATH = "/wham/rate-limit-reset-credits/consume";

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
  const token = await getAuthToken(ctx.modelRegistry, PROVIDER);
  if (!token) return;

  const client = createClient(token);

  const credit = await showCodexResetSelector(ctx, async (signal) => {
    const [usage, details] = await Promise.all([fetchUsage(client, signal), fetchResetCredits(client, signal)]);

    return {
      ...details,
      usage: toCredits(usage, `· ${formatAvailableResets(details.available_count)}`),
    } satisfies CodexResetPanelData;
  });
  if (!credit || !(await confirmCodexReset(ctx, credit))) return;

  await redeemReset(ctx, client, credit, refresh);
}

async function redeemReset(ctx: ExtensionContext, client: KyInstance, credit: BankedRateLimitReset, refresh: RefreshCredits): Promise<void> {
  await showCodexResetLoader(ctx, async () => {
    const response = await consumeReset(client, uuidv7(), credit.id);
    if (response.code === "nothing_to_reset") throw new Error("No Codex rate-limit window currently needs a reset");
    if (response.code === "no_credit") throw new Error("No Codex resets are available");
  }).finally(() => refresh(ctx));
}

function createClient(apiKey: string): KyInstance {
  const client = withAuth(http, apiKey);
  const credential = readStoredCredential(PROVIDER);
  const accountId = credential?.type === "oauth" ? credential.accountId : undefined;

  return typeof accountId === "string" && accountId.length > 0
    ? client.extend({ headers: { "ChatGPT-Account-ID": accountId } })
    : client;
}

async function fetchUsage(client: KyInstance, signal: AbortSignal): Promise<CodexUsageResponse> {
  return client.get(`${BASE_URL}${USAGE_PATH}`, { signal }).json<CodexUsageResponse>();
}

async function fetchResetCredits(client: KyInstance, signal: AbortSignal): Promise<RateLimitResetCreditsResponse> {
  return client.get(`${BASE_URL}${RESET_CREDITS_PATH}`, { signal }).json<RateLimitResetCreditsResponse>();
}

async function consumeReset(client: KyInstance, redeemRequestId: string, creditId: string): Promise<ConsumeResetResponse> {
  return client.post(`${BASE_URL}${CONSUME_RESET_PATH}`, {
    json: {
      redeem_request_id: redeemRequestId,
      credit_id: creditId
    },
  }).json<ConsumeResetResponse>();
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
    const client = createClient(apiKey);
    const usage = await fetchUsage(client, signal);
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
