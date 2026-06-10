import { findProvider } from "./providers";
import { renderCredits, renderError } from "./status";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CreditsProvider } from "./types";

const STATUS_KEY = "credits";
const REQUEST_TIMEOUT_MS = 30_000;

export class CreditsManager {
  private inflight: AbortController | undefined = undefined;

  async refresh(ctx: ExtensionContext): Promise<void> {
    this.inflight?.abort();

    const provider = findProvider(ctx.model?.provider);
    if (!provider) {
      this.inflight = undefined;
      ctx.ui.setStatus(STATUS_KEY, undefined);
      return;
    }

    const controller = new AbortController();
    this.inflight = controller;

    await this.fetch(ctx, provider, controller.signal).finally(() => {
      if (this.inflight === controller) this.inflight = undefined;
    });
  }

  private async fetch(ctx: ExtensionContext, provider: CreditsProvider, signal: AbortSignal): Promise<void> {
    try {
      const apiKey = await ctx.modelRegistry.getApiKeyForProvider(provider.provider);
      if (!apiKey) {
        ctx.ui.setStatus(STATUS_KEY, undefined);
        return;
      }

      const signals = [AbortSignal.timeout(REQUEST_TIMEOUT_MS), signal];
      if (ctx.signal) signals.push(ctx.signal);

      const credits = await provider.fetch(ctx, apiKey, AbortSignal.any(signals));

      // The active model may have changed while the request was in flight.
      if (ctx.model?.provider !== provider.provider) return;

      ctx.ui.setStatus(STATUS_KEY, renderCredits(ctx.ui.theme, provider.label, credits));
    } catch (error) {
      if (signal.aborted || ctx.signal?.aborted) return;
      if (ctx.model?.provider !== provider.provider) return;

      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.setStatus(STATUS_KEY, renderError(ctx.ui.theme, provider.label, message));
    }
  }
}
