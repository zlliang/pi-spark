import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CreditsProvider } from "./types";

export type Cost = Model<Api>["cost"] & { label?: string };

/**
 * A time-of-day price window. `start`/`end` are `HH:MM` in UTC. Bounds are [start, end); equal
 * bounds mean all day. When `start > end` the window wraps past midnight (e.g., 16:30 → 00:30).
 */
interface PricingWindow {
  start: string;
  end: string;
  days?: number[];
  cost: Cost;
}

export interface PricingRule {
  model: string;
  defaultCost: Cost;
  windows: PricingWindow[];
}

/** Updates registry and active model prices without changing the provider's rule data. */
export function applyPricingRules(ctx: ExtensionContext, provider: CreditsProvider, timestamp: number): void {
  (provider.pricingRules ?? []).forEach((rule) => {
    const cost = resolveCost(rule, timestamp);
    const model = ctx.modelRegistry.find(provider.id, rule.model);

    if (model) model.cost = { ...cost };
    if (ctx.model?.provider === provider.id && ctx.model.id === rule.model) ctx.model.cost = { ...cost };
  });
}

function resolveCost(rule: PricingRule, timestamp: number): Cost {
  const date = new Date(timestamp);
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();

  const cost = rule.windows.reduce((result, window) => {
    if (window.days && !window.days.includes(date.getUTCDay())) return result;
    if (inDailyRange(minutes, parseHHMM(window.start), parseHHMM(window.end))) return window.cost;
    return result;
  }, rule.defaultCost);

  return cost;
}

function parseHHMM(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function inDailyRange(minutes: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}
