import { deepseekProvider } from "./deepseek";
import { fireworksProvider } from "./fireworks";
import { kimiCodeProvider } from "./kimi-code";
import { moonshotProvider, moonshotCnProvider } from "./moonshot";
import { openaiCodexProvider } from "./openai-codex";
import { openrouterProvider } from "./openrouter";
import { vercelAiGatewayProvider } from "./vercel-ai-gateway";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CreditsConfig } from "../config";
import type { CreditsProvider, RefreshCredits } from "../types";

const PROVIDERS: CreditsProvider[] = [
  deepseekProvider,
  fireworksProvider,
  kimiCodeProvider,
  moonshotProvider,
  moonshotCnProvider,
  openaiCodexProvider,
  openrouterProvider,
  vercelAiGatewayProvider,
];

export function getEnabledProviders(config: CreditsConfig): CreditsProvider[] {
  const settings = config.providers as Partial<Record<string, boolean>> | undefined;
  return PROVIDERS.filter((provider) => settings?.[provider.id] !== false);
}

export function findProvider(providers: CreditsProvider[], provider?: string): CreditsProvider | undefined {
  return providers.find((entry) => entry.id === provider);
}

export function registerProviderExtensions(pi: ExtensionAPI, ctx: ExtensionContext, providers: CreditsProvider[], refresh: RefreshCredits): void {
  for (const provider of providers) provider.register?.(pi, ctx, refresh);
}
