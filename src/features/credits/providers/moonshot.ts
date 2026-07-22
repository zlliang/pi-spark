import { convertToUSD, toNumber } from "../../../utils/format";
import { http, withAuth } from "../../../utils/http";

import type { Credits, CreditsProvider } from "../types";

interface MoonshotBalanceResponse {
  data?: {
    available_balance?: string | number;
  } | null;
}

/**
 * For Moonshot, the international and China-mainland accounts live on separate hosts and bill in
 * different currencies (USD vs CNY), which the endpoint does not report, so each Pi provider ID
 * fixes both host and currency.
 */
function createMoonshotProvider(id: "moonshotai" | "moonshotai-cn", host: string, currency: string): CreditsProvider {
  return {
    id,
    label: "Moonshot",

    async fetch(apiKey, signal): Promise<Credits> {
      const payload = await withAuth(http, apiKey).get(`https://${host}/v1/users/me/balance`, { signal }).json<MoonshotBalanceResponse>();
      const remaining = await convertToUSD(toNumber(payload.data?.available_balance), currency, signal);

      return { type: "balance", remaining };
    },
  };
}

export const moonshotProvider = createMoonshotProvider("moonshotai", "api.moonshot.ai", "USD");
export const moonshotCnProvider = createMoonshotProvider("moonshotai-cn", "api.moonshot.cn", "CNY");
