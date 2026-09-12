import { convertToUSD, toNumber } from "../../../utils/format";
import { http, withAuth } from "../../../utils/http";

import type { Cost } from "../pricing";
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
  link: "https://platform.deepseek.com/usage",

  // See https://api-docs.deepseek.com/quick_start/pricing/.
  pricingRules: [
    {
      model: "deepseek-flash",
      defaultCost: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0, label: "off-peak" },
      windows: [
        { start: "01:00", end: "04:00", days: [1, 2, 3, 4, 5], cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0, label: "peak" } },
        { start: "06:00", end: "10:00", days: [1, 2, 3, 4, 5], cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0, label: "peak" } },
      ],
    },
    {
      model: "deepseek-v4-flash",
      defaultCost: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0, label: "off-peak" },
      windows: [
        { start: "01:00", end: "04:00", days: [1, 2, 3, 4, 5], cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0, label: "peak" } },
        { start: "06:00", end: "10:00", days: [1, 2, 3, 4, 5], cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0, label: "peak" } },
      ],
    },
    {
      model: "deepseek-v4-flash-vision-exp",
      defaultCost: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0, label: "off-peak" },
      windows: [
        { start: "01:00", end: "04:00", days: [1, 2, 3, 4, 5], cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0, label: "peak" } },
        { start: "06:00", end: "10:00", days: [1, 2, 3, 4, 5], cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0, label: "peak" } },
      ],
    },
    {
      model: "deepseek-v4-pro",
      defaultCost: { input: 0.66, output: 1.98, cacheRead: 0.022, cacheWrite: 0, label: "off-peak" },
      windows: [
        { start: "01:00", end: "04:00", days: [1, 2, 3, 4, 5], cost: { input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 0, label: "peak" } },
        { start: "06:00", end: "10:00", days: [1, 2, 3, 4, 5], cost: { input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 0, label: "peak" } },
      ],
    },
  ],

  async fetch(apiKey, signal, cost?: Cost): Promise<Credits> {
    const payload = await withAuth(http, apiKey).get(URL, { signal }).json<DeepSeekBalanceResponse>();
    const balance = payload.balance_infos?.find((entry) => entry.currency === "USD") ?? payload.balance_infos?.[0];
    const remaining = await convertToUSD(toNumber(balance?.total_balance), balance?.currency, signal);

    return { type: "balance", remaining, suffix: cost?.label ? `(${cost.label})` : undefined };
  },
};
