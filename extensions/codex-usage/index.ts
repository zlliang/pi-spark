import { CodexUsageManager } from "./manager";
import { loadConfig } from "../shared/config";
import { isUsage } from "../shared/usage";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

function hasCostedUsage(messages: AgentMessage[]): boolean {
  return messages.some((message) => {
    const usage = (message as { usage?: unknown }).usage;
    if (!isUsage(usage)) return false;

    return usage.cost.total > 0 || usage.input > 0 || usage.output > 0;
  });
}

export default function (pi: ExtensionAPI) {
  let codexUsageManager: CodexUsageManager | undefined = undefined;

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;

    const config = loadConfig(ctx, "codexUsage");
    if (!config) return;

    codexUsageManager = new CodexUsageManager();
    codexUsageManager.refresh(ctx);
  });

  pi.on("model_select", (_event, ctx) => {
    codexUsageManager?.refresh(ctx);
  });

  pi.on("agent_end", (event, ctx) => {
    if (!hasCostedUsage(event.messages)) return;

    codexUsageManager?.refresh(ctx);
  });

  pi.on("session_shutdown", () => {
    codexUsageManager = undefined;
  });
}
