import type { Provider } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Normalized credits/usage for a provider.
 *
 * - `balance` providers (e.g., OpenRouter, Vercel AI Gateway) report a remaining dollar balance.
 * - `windows` providers (e.g., OpenAI Codex) report rate-limit windows as used percentages.
 */
export type Credits =
  | { type: "balance"; remaining?: number | undefined }
  | { type: "windows"; lanes: CreditsLane[]; unlimited?: boolean | undefined };

export interface CreditsLane {
  label: string;
  percent: number | undefined;
}

/** A credits source for a pi provider, shown in the status line while that provider is active. */
export interface CreditsProvider {
  readonly provider: Provider;
  readonly label: string;
  fetch(ctx: ExtensionContext, apiKey: string, signal: AbortSignal): Promise<Credits>;
}
