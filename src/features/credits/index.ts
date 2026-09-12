import { CreditsManager } from "./manager";
import { getEnabledProviders, registerProviderExtensions } from "./providers";
import { loadConfig } from "../../config";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerCredits(pi: ExtensionAPI): void {
  let creditsManager: CreditsManager | undefined = undefined;

  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).credits;
    if (!config) return;

    const providers = getEnabledProviders(config);
    if (providers.length === 0) return;

    creditsManager = new CreditsManager(providers);
    registerProviderExtensions(pi, ctx, providers, async (ctx) => await creditsManager?.refresh(ctx));

    creditsManager.refresh(ctx);
  });

  // Background calls run at `before_agent_start`, before the first `context` event, and the model
  // registry may have been refreshed since the last apply.
  pi.on("input", (_event, ctx) => {
    creditsManager?.refresh(ctx);
  });

  pi.on("model_select", (_event, ctx) => {
    creditsManager?.refresh(ctx);
  });

  pi.on("context", (_event, ctx) => {
    creditsManager?.refresh(ctx);
  });

  pi.on("turn_end", (_event, ctx) => {
    creditsManager?.refresh(ctx);
  });

  pi.on("agent_settled", (_event, ctx) => {
    creditsManager?.refresh(ctx);
  });

  pi.on("session_before_compact", (_event, ctx) => {
    creditsManager?.refresh(ctx);
  });

  pi.on("session_compact", (_event, ctx) => {
    creditsManager?.refresh(ctx);
  });

  pi.on("session_before_tree", (event, ctx) => {
    if (!event.preparation.userWantsSummary) return;

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
