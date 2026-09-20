import { convertToUSD, toNumber } from "../../../utils/format";
import { http, withAuth } from "../../../utils/http";

import type { Cost } from "../pricing";
import type { Credits, CreditsProvider } from "../types";

import holidays2026 from "../../../data/holiday-cn-2026.json" with { type: "json" };

const PROVIDER = "deepseek";
const URL = "https://api.deepseek.com/user/balance";
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const HOLIDAYS = new Set(holidays2026.days.filter((day) => day.isOffDay).map((day) => day.date));

interface DeepSeekBalanceResponse {
  balance_infos?: DeepSeekBalanceInfo[] | null;
}

interface DeepSeekBalanceInfo {
  currency?: string;
  total_balance?: string | number;
}

/** Checks for an all-day off-peak date in Beijing, including weekends with makeup work. */
function isDeepSeekOffPeakDay(timestamp: number): boolean {
  // Beijing uses UTC+8 without daylight saving time.
  const date = new Date(timestamp + BEIJING_OFFSET_MS);
  const day = date.getUTCDay();

  // Years without bundled holiday data fall back to weekends only.
  return day === 0 || day === 6 || HOLIDAYS.has(date.toISOString().slice(0, 10));
}

export const deepseekProvider: CreditsProvider = {
  id: PROVIDER,
  label: "DeepSeek",
  link: "https://platform.deepseek.com/usage",

  // See https://api-docs.deepseek.com/quick_start/pricing/.
  pricingRules(timestamp) {
    const offPeakDay = isDeepSeekOffPeakDay(timestamp);

    return [
      {
        model: "deepseek-flash",
        defaultCost: { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0, label: "Off-peak" },
        windows: offPeakDay ? [] : [
          { start: "01:00", end: "04:00", cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0, label: "Peak" } },
          { start: "06:00", end: "10:00", cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0, label: "Peak" } },
        ],
      },
      {
        model: "deepseek-v4-pro",
        defaultCost: { input: 0.66, output: 1.98, cacheRead: 0.022, cacheWrite: 0, label: "Off-peak" },
        windows: offPeakDay ? [] : [
          { start: "01:00", end: "04:00", cost: { input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 0, label: "Peak" } },
          { start: "06:00", end: "10:00", cost: { input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 0, label: "Peak" } },
        ],
      },
    ];
  },

  async fetch(apiKey, signal, cost?: Cost): Promise<Credits> {
    const payload = await withAuth(http, apiKey).get(URL, { signal }).json<DeepSeekBalanceResponse>();
    const balance = payload.balance_infos?.find((entry) => entry.currency === "USD") ?? payload.balance_infos?.[0];
    const remaining = await convertToUSD(toNumber(balance?.total_balance), balance?.currency, signal);

    return { type: "balance", remaining, suffix: cost?.label ? `(${cost.label})` : undefined };
  },
};
