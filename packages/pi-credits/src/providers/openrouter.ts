import { toNumber } from "../utils";

import type { Credits, CreditsProvider } from "../types";

const PROVIDER = "openrouter";
const URL = "https://openrouter.ai/api/v1/credits";

interface OpenRouterCreditsResponse {
  data?: {
    total_credits?: number | null;
    total_usage?: number | null;
  } | null;
}

export const openrouterProvider: CreditsProvider = {
  id: PROVIDER,
  label: "OpenRouter",

  async fetch(_ctx, apiKey, signal): Promise<Credits> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const response = await fetch(URL, { headers, signal });
    if (!response.ok) throw new Error("request failed");

    const payload = (await response.json()) as OpenRouterCreditsResponse;
    const totalCredits = toNumber(payload.data?.total_credits);
    const totalUsage = toNumber(payload.data?.total_usage);
    const remaining = typeof totalCredits === "number" && typeof totalUsage === "number" ? totalCredits - totalUsage : undefined;

    return { type: "balance", remaining };
  },
};
