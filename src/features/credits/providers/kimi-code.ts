import { toNumber } from "../../../utils/format";

import type { Credits, CreditsLane, CreditsProvider } from "../types";

const PROVIDER = "kimi-coding";
const URL = "https://api.kimi.com/coding/v1/usages";
const BOOSTER_FIXED_POINT_CENTS = 1_000_000;

interface KimiCodeUsage {
  limit?: string | number;
  used?: string | number;
  remaining?: string | number;
}

interface KimiCodeLimit {
  window?: { duration?: number; timeUnit?: string } | null;
  detail?: KimiCodeUsage | null;
}

interface KimiCodeBoosterWallet {
  balance?: {
    type?: string;
    amount?: string | number;
    amountLeft?: string | number;
  } | null;
}

interface KimiCodeUsageResponse {
  usage?: KimiCodeUsage | null;
  limits?: KimiCodeLimit[] | null;
  boosterWallet?: KimiCodeBoosterWallet | null;
}

function toPercent(detail: KimiCodeUsage): number | undefined {
  const limit = toNumber(detail.limit);
  let used = toNumber(detail.used);

  if (used === undefined && limit !== undefined) {
    const remaining = toNumber(detail.remaining);
    if (remaining !== undefined) used = limit - remaining;
  }

  if (used === undefined || limit === undefined || limit <= 0) return undefined;

  return Math.min(100, Math.max(0, (used / limit) * 100));
}

function formatWindowLabel(window?: { duration?: number; timeUnit?: string } | null): string {
  if (!window?.duration) return "Limit";

  const duration = window.duration;
  const unit = window.timeUnit?.toUpperCase() ?? "";

  if (unit === "TIME_UNIT_MINUTE") {
    if (duration >= 60 && duration % 60 === 0) return `${duration / 60}h`;
    return `${duration}m`;
  }
  if (unit === "TIME_UNIT_HOUR") return `${duration}h`;
  if (unit === "TIME_UNIT_DAY") return `${duration}d`;
  if (unit === "TIME_UNIT_MONTH") return `${duration}mo`;
  return `${duration}${unit.replace("TIME_UNIT_", "").toLowerCase()}`;
}

function buildLane(label: string, detail: KimiCodeUsage): CreditsLane | undefined {
  const percent = toPercent(detail);
  return percent === undefined ? undefined : { label, percent };
}

function formatSuffix(wallet?: KimiCodeBoosterWallet | null): string | undefined {
  if (wallet?.balance?.type !== "BOOSTER") return undefined;

  const amount = toNumber(wallet.balance.amount);
  if (amount === undefined || amount <= 0) return undefined;

  const amountLeft = Math.max(0, toNumber(wallet.balance.amountLeft) ?? 0);
  const remaining = Math.round(amountLeft / BOOSTER_FIXED_POINT_CENTS) / 100;
  return `(Extra Usage $${remaining.toFixed(2)})`;
}

export const kimiCodeProvider: CreditsProvider = {
  id: PROVIDER,
  label: "Kimi Code",

  async fetch(apiKey, signal): Promise<Credits> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const response = await fetch(URL, { headers, signal });
    if (!response.ok) throw new Error("request failed");

    const payload = (await response.json()) as KimiCodeUsageResponse;
    const lanes: CreditsLane[] = [];

    payload.limits?.forEach((item) => {
      if (!item.detail) return;

      const lane = buildLane(formatWindowLabel(item.window), item.detail);
      if (lane) lanes.push(lane);
    });

    if (payload.usage) {
      const weeklyLane = buildLane("7d", payload.usage);
      if (weeklyLane) lanes.push(weeklyLane);
    }

    if (lanes.length === 0) throw new Error("no usage data");

    return { type: "windows", lanes, suffix: formatSuffix(payload.boosterWallet) };
  },
};
