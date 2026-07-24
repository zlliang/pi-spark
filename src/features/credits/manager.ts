import { getAuthToken } from "../../utils/auth";
import { findProvider } from "./providers";
import { renderCredits, renderError } from "./status";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CreditsProvider } from "./types";

const STATUS_KEY = "credits";

export class CreditsManager {
  private inflight: AbortController | undefined = undefined;
  private providers: CreditsProvider[];
  private currentProvider: string | undefined = undefined;

  constructor(providers: CreditsProvider[]) {
    this.providers = providers;
  }

  async refresh(ctx: ExtensionContext): Promise<void> {
    this.inflight?.abort();

    const provider = findProvider(this.providers, ctx.model?.provider);
    if (!provider) {
      this.inflight = undefined;
      this.currentProvider = undefined;
      ctx.ui.setStatus(STATUS_KEY, undefined);
      return;
    }

    // Clear stale credits from another provider while the new fetch is in flight.
    if (this.currentProvider !== provider.id) {
      this.currentProvider = provider.id;
      ctx.ui.setStatus(STATUS_KEY, undefined);
    }

    const controller = new AbortController();
    this.inflight = controller;

    await this.fetch(ctx, provider, controller.signal).finally(() => {
      if (this.inflight === controller) this.inflight = undefined;
    });
  }

  cancel(): void {
    this.inflight?.abort();
    this.inflight = undefined;
  }

  private async fetch(ctx: ExtensionContext, provider: CreditsProvider, signal: AbortSignal): Promise<void> {
    try {
      const token = await getAuthToken(ctx.modelRegistry, provider.id);
      if (signal.aborted) return;
      if (!token) {
        ctx.ui.setStatus(STATUS_KEY, undefined);
        return;
      }

      const credits = await provider.fetch(token, signal);

      // The active model may have changed while the request was in flight.
      if (ctx.model?.provider !== provider.id) return;

      ctx.ui.setStatus(STATUS_KEY, renderCredits(ctx.ui.theme, provider.label, credits));
    } catch (error) {
      if (signal.aborted) return;
      if (ctx.model?.provider !== provider.id) return;

      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.setStatus(STATUS_KEY, renderError(ctx.ui.theme, provider.label, message));
    }
  }
}
