import { CreditsManager } from "./manager";
import { getEnabledProviders, registerProviderExtensions } from "./providers";
import { loadConfig } from "../../config";
import { isUsage } from "../../utils/usage";

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function hasCost(message: AgentMessage): boolean {
  const usage = (message as { usage?: unknown }).usage;
  if (!isUsage(usage)) return false;

  return usage.cost.total > 0 || usage.input > 0 || usage.output > 0;
}

export function registerCredits(pi: ExtensionAPI): void {
  let creditsManager: CreditsManager | undefined = undefined;

  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).credits;
    if (ctx.mode !== "tui" || !config) return;

    const providers = getEnabledProviders(config);
    if (providers.length === 0) return;

    creditsManager = new CreditsManager(providers);
    registerProviderExtensions(pi, ctx, providers, async (ctx) => await creditsManager?.refresh(ctx));

    creditsManager.refresh(ctx);
  });

  pi.on("model_select", (_event, ctx) => {
    creditsManager?.refresh(ctx);
  });

  pi.on("turn_end", (event, ctx) => {
    if (!hasCost(event.message)) return;

    creditsManager?.refresh(ctx);
  });

  pi.on("session_compact", (_event, ctx) => {
    creditsManager?.refresh(ctx);
  });

  pi.on("session_tree", (event, ctx) => {
    if (!event.summaryEntry) return;

    creditsManager?.refresh(ctx);
  });

  pi.on("session_shutdown", () => {
    creditsManager?.cancel();
    creditsManager = undefined;
  });
}
