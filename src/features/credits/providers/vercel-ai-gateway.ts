import { toNumber } from "../../../utils/format";
import { http, withAuth } from "../../../utils/http";

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
    const payload = await withAuth(http, apiKey).get(URL, { signal }).json<VercelCreditsResponse>();
    const remaining = toNumber(payload.balance);

    return { type: "balance", remaining };
  },
};
