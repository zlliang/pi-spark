import { deepseekProvider } from "./deepseek";
import { fireworksProvider } from "./fireworks";
import { kimiCodeProvider } from "./kimi-code";
import { moonshotProvider, moonshotCnProvider } from "./moonshot";
import { openaiCodexProvider } from "./openai-codex";
import { openrouterProvider } from "./openrouter";
import { vercelAiGatewayProvider } from "./vercel-ai-gateway";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
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

export function findProvider(provider?: string): CreditsProvider | undefined {
  return PROVIDERS.find((entry) => entry.id === provider);
}

export function registerProviderExtensions(pi: ExtensionAPI, ctx: ExtensionContext, refresh: RefreshCredits): void {
  for (const provider of PROVIDERS) provider.register?.(pi, ctx, refresh);
}
