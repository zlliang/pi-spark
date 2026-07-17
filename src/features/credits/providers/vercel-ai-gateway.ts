import { toNumber } from "../../../utils/format";

import type { Credits, CreditsProvider } from "../types";

const PROVIDER = "vercel-ai-gateway";
const URL = "https://ai-gateway.vercel.sh/v1/credits";

interface VercelCreditsResponse {
  balance?: string | number;
}

export const vercelAiGatewayProvider: CreditsProvider = {
  id: PROVIDER,
  label: "Vercel",

  async fetch(apiKey, signal): Promise<Credits> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const response = await fetch(URL, { headers, signal });
    if (!response.ok) throw new Error("request failed");

    const payload = (await response.json()) as VercelCreditsResponse;
    const remaining = toNumber(payload.balance);

    return { type: "balance", remaining };
  },
};
