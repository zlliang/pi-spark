import { toNumber } from "../../../utils/format";

import type { Credits, CreditsLane, CreditsProvider } from "../types";

const PROVIDER = "kimi-coding";
const URL = "https://api.kimi.com/coding/v1/usages";

interface KimiCodeUsageResponse {
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

function buildLane(label: string, detail?: KimiCodeUsageResponse["usage"]): CreditsLane {
  return { label, percent: toPercent(toNumber(detail?.used)) };
}

export const kimiCodeProvider: CreditsProvider = {
  id: PROVIDER,
  label: "Kimi Code",

  async fetch(_ctx, apiKey, signal): Promise<Credits> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const response = await fetch(URL, { headers, signal });
    if (!response.ok) throw new Error("request failed");

    const payload = (await response.json()) as KimiCodeUsageResponse;
    const lanes: CreditsLane[] = [];

    payload.limits?.forEach((item) => {
      if (!item) return;

      const label = formatWindowLabel(item.window);
      lanes.push(buildLane(label, item.detail));
    });

    const weeklyLane = buildLane("7d", payload.usage);
    lanes.push(weeklyLane);

    return { type: "windows", lanes };
  },
};
