import type { ProviderId } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Normalized credits/usage for a provider.
 *
 * - `balance` providers (e.g., OpenRouter, Vercel AI Gateway) report a remaining dollar balance.
 * - `windows` providers (e.g., OpenAI Codex) report rate-limit windows as used percentages.
 */
export type Credits = (
  | { type: "balance"; remaining?: number | undefined }
  | { type: "windows"; lanes: CreditsLane[]; unlimited?: boolean | undefined }
) & { suffix?: string | undefined };

export interface CreditsLane {
  label: string;
  percent: number | undefined;
}

export type RefreshCredits = (ctx: ExtensionContext) => Promise<void>;

/** A credits source for a Pi provider, shown in the status line while that provider is active. */
export interface CreditsProvider {
  readonly id: ProviderId;
  readonly label: string;
  fetch(ctx: ExtensionContext, apiKey: string, signal: AbortSignal): Promise<Credits>;
  register?(pi: ExtensionAPI, ctx: ExtensionContext, refresh: RefreshCredits): void;
}
