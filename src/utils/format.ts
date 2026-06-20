import { isAbsolute, relative, resolve, sep } from "node:path";

import type { Provider } from "@earendil-works/pi-ai";
import type { ContextUsage } from "@earendil-works/pi-coding-agent";

export function formatModel(provider?: Provider, model?: string, thinkingLevel?: string): string {
  return provider && model ? `${provider}/${model}${thinkingLevel ? `:${thinkingLevel}` : ""}` : "no-model";
}

export function formatTokens(count: number): string {
  if (count < 1_000) return count.toString();
  if (count < 10_000) return `${(count / 1_000).toFixed(1)}K`;
  if (count < 1_000_000) return `${Math.round(count / 1_000)}K`;
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000_000)}M`;
}

export function formatContextUsage(contextUsage: ContextUsage | undefined): string {
  const tokens = contextUsage?.tokens ?? null;
  const contextWindow = contextUsage?.contextWindow ?? null;
  const percent = contextUsage?.percent ?? null;
  const percentText = percent === null ? "?" : `${percent.toFixed(1)}%`;

  return `${tokens === null ? "?" : formatTokens(tokens)}/${contextWindow === null ? "?" : formatTokens(contextWindow)} (${percentText})`;
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function formatCwd(cwd: string, home: string): string {
  const resolvedCwd = resolve(cwd);
  const resolvedHome = resolve(home);
  const relativeToHome = relative(resolvedHome, resolvedCwd);
  const isInsideHome = relativeToHome === "" || (relativeToHome !== ".." && !relativeToHome.startsWith(`..${sep}`) && !isAbsolute(relativeToHome));
  const displayCwd = isInsideHome ? (relativeToHome === "" ? "~" : `~${sep}${relativeToHome}`) : resolvedCwd;

  return shortenPath(displayCwd);
}

/** Shorten every path component except the first and last to one character, like fish `prompt_pwd`. */
function shortenPath(path: string): string {
  const parts = path.split(sep);
  const lastIndex = parts.length - 1;

  return parts.map((part, index) => {
    if (!part || index === 0 || index === lastIndex) return part;
    return Array.from(part)[0] ?? part;
  }).join(sep);
}

/** Wrap text in an OSC 8 hyperlink while preserving the visible text. */
export function linkText(text: string, url: string): string {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

/** Replace newlines, tabs, carriage returns with space, then collapse multiple spaces */
export function sanitizeText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

/** Coerce a possibly-stringified numeric value to a finite number, or `undefined`. */
export function toNumber(value?: string | number | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const FRANKFURTER_API = "https://api.frankfurter.dev/v2/rate";

interface FrankfurterRateResponse {
  rate?: string | number;
}

/** Convert an amount in the given currency to USD via the Frankfurter API. */
export async function convertToUSD(amount: number | undefined, currency: string | undefined, signal: AbortSignal): Promise<number | undefined> {
  if (amount === undefined) return undefined;
  if (!currency || currency === "USD") return amount;

  const url = `${FRANKFURTER_API}/${encodeURIComponent(currency)}/USD`;
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error("currency conversion failed");

  const payload = (await response.json()) as FrankfurterRateResponse;
  const rate = toNumber(payload.rate);
  if (rate === undefined) throw new Error("currency conversion failed");

  return amount * rate;
}
