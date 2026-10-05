import { toNumber } from "../../../utils/format";
import { http, withAuth } from "../../../utils/http";

import type { Credits, CreditsLane, CreditsProvider } from "../types";

const PROVIDER = "opencode-go";
const URL = "https://opencode.ai/zen/go/v1/usage";

interface OpenCodeGoWindow {
  percent?: string | number;
  resetsAt?: string | null;
}

interface OpenCodeGoUsageResponse {
  usage?: {
    rolling?: OpenCodeGoWindow;
    weekly?: OpenCodeGoWindow;
    monthly?: OpenCodeGoWindow;
  } | null;
}

function toLane([label, window]: [string, OpenCodeGoWindow]): CreditsLane {
  const percent = toNumber(window.percent);
  if (percent === undefined) throw new Error("no usage data");

  const resetAt = Date.parse(window.resetsAt ?? "");
  return { label, percent, resetAt: Number.isFinite(resetAt) ? resetAt : undefined };
}

export const opencodeGoProvider: CreditsProvider = {
  id: PROVIDER,
  label: "OpenCode Go",
  link: "https://opencode.ai/console/go",

  async fetch(apiKey, signal): Promise<Credits> {
    const payload = await withAuth(http, apiKey).get(URL, { signal }).json<OpenCodeGoUsageResponse>();
    const usage = payload.usage;

    const lanes = [["5h", usage?.rolling], ["7d", usage?.weekly], ["1mo", usage?.monthly]]
      .filter((entry): entry is [string, OpenCodeGoWindow] => Boolean(entry[1]))
      .map(toLane);

    if (lanes.length === 0) throw new Error("no usage data");

    return { type: "windows", lanes };
  },
};
