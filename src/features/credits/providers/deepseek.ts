import { convertToUSD, toNumber } from "../../../utils/format";
import { http, withAuth } from "../../../utils/http";

import type { Credits, CreditsProvider } from "../types";

const PROVIDER = "deepseek";
const URL = "https://api.deepseek.com/user/balance";

interface DeepSeekBalanceResponse {
  balance_infos?: DeepSeekBalanceInfo[] | null;
}

interface DeepSeekBalanceInfo {
  currency?: string;
  total_balance?: string | number;
}

export const deepseekProvider: CreditsProvider = {
  id: PROVIDER,
  label: "DeepSeek",

  async fetch(apiKey, signal): Promise<Credits> {
    const payload = await withAuth(http, apiKey).get(URL, { signal }).json<DeepSeekBalanceResponse>();
    const balance = payload.balance_infos?.find((entry) => entry.currency === "USD") ?? payload.balance_infos?.[0];
    const remaining = await convertToUSD(toNumber(balance?.total_balance), balance?.currency, signal);

    return { type: "balance", remaining };
  },
};
