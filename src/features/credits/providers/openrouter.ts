import { toNumber } from "../../../utils/format";
import { http, withAuth } from "../../../utils/http";

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

  async fetch(apiKey, signal): Promise<Credits> {
    const payload = await withAuth(http, apiKey).get(URL, { signal }).json<OpenRouterCreditsResponse>();
    const totalCredits = toNumber(payload.data?.total_credits);
    const totalUsage = toNumber(payload.data?.total_usage);
    const remaining = typeof totalCredits === "number" && typeof totalUsage === "number" ? totalCredits - totalUsage : undefined;

    return { type: "balance", remaining };
  },
};
