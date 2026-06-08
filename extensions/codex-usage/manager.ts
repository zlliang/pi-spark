import { CODEX_PROVIDER, fetchCodexUsage, readAccountId } from "./client";
import { renderError, renderUsage } from "./status";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "codex-usage";

export class CodexUsageManager {
  private inflight: Promise<void> | undefined = undefined;

  async refresh(ctx: ExtensionContext): Promise<void> {
    if (!this.isCodexContext(ctx)) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
      return;
    }

    if (this.inflight) return this.inflight;

    this.inflight = this.fetch(ctx).finally(() => {
      this.inflight = undefined;
    });

    return this.inflight;
  }

  private async fetch(ctx: ExtensionContext): Promise<void> {
    try {
      const token = await ctx.modelRegistry.getApiKeyForProvider(CODEX_PROVIDER);
      if (!token) {
        ctx.ui.setStatus(STATUS_KEY, undefined);
        return;
      }

      const usage = await fetchCodexUsage(token, readAccountId(ctx), ctx.signal);
      if (!this.isCodexContext(ctx)) return;

      ctx.ui.setStatus(STATUS_KEY, renderUsage(ctx.ui.theme, usage));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.setStatus(STATUS_KEY, renderError(ctx.ui.theme, message));
    }
  }

  private isCodexContext(ctx: ExtensionContext): boolean {
    return ctx.model?.provider === CODEX_PROVIDER;
  }
}
