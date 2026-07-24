import type { ProviderId } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

export async function getAuthToken(modelRegistry: ModelRegistry, provider: ProviderId): Promise<string | undefined> {
  const providerAuth = await modelRegistry.getProviderAuth(provider);

  const authorization = Object.entries(providerAuth?.auth.headers ?? {}).find(([name]) => name.toLowerCase() === "authorization")?.[1];
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  return providerAuth?.auth.apiKey ?? bearerToken;
}
