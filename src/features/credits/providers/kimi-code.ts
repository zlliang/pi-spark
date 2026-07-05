import { toNumber } from "../../../utils/format";

import type { Credits, CreditsLane, CreditsProvider } from "../types";

const PROVIDER = "kimi-coding";
const URL = "https://api.kimi.com/coding/v1/usages";

interface KimiCodeUsagesResponse {
  usage?: { used?: string | number } | null;
  limits?: {
    window?: { duration?: number; timeUnit?: string } | null;
    detail?: { used?: string | number } | null;
  }[] | null;
}

function toPercent(used: number | undefined): number | undefined {
  if (used === undefined) return undefined;
  return Math.min(100, Math.max(0, used));
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

function buildLane(detail: { used?: string | number } | null | undefined, label: string): CreditsLane {
  return { label, percent: toPercent(toNumber(detail?.used)) };
}

export const kimiCodingProvider: CreditsProvider = {
  id: PROVIDER,
  label: "Kimi Code",

  async fetch(_ctx, apiKey, signal): Promise<Credits> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const response = await fetch(URL, { headers, signal });
    if (!response.ok) throw new Error("request failed");

    const payload = (await response.json()) as KimiCodeUsagesResponse;
    const lanes: CreditsLane[] = [];

    if (payload.limits) {
      for (const item of payload.limits) {
        if (!item) continue;
        const label = formatWindowLabel(item.window);
        lanes.push(buildLane(item.detail, label));
      }
    }

    const weeklyLane = buildLane(payload.usage, "7d");
    if (weeklyLane) lanes.push(weeklyLane);

    return { type: "windows", lanes };
  },
};
