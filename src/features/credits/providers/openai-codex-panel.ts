import { DynamicBorder, keyHint, rawKeyHint } from "@earendil-works/pi-coding-agent";
import { Box, Container, matchesKey, SelectList, Spacer, Text } from "@earendil-works/pi-tui";

import { Loader } from "../../../components/loader";
import { renderCredits } from "../status";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SelectItem } from "@earendil-works/pi-tui";
import type { BankedRateLimitReset, RateLimitResetCreditsResponse } from "./openai-codex";
import type { Credits } from "../types";

const DATE_COLUMN_WIDTH = 14;

export interface CodexResetPanelData extends RateLimitResetCreditsResponse {
  usage: Credits;
}

export async function showCodexResetSelector(ctx: ExtensionContext, load: (signal: AbortSignal) => Promise<CodexResetPanelData>): Promise<BankedRateLimitReset | undefined> {
  const selected = await ctx.ui.custom<BankedRateLimitReset | null>((tui, theme, _keybindings, done) => {
    const controller = new AbortController();

    const container = new Container();
    const box = new Box(1, 1);
    const loader = new Loader(tui, (text) => theme.fg("accent", text), (text) => theme.fg("muted", text), "Loading...");

    let settled = false;
    let selectList: SelectList | undefined;

    const finish = (value: BankedRateLimitReset | null) => {
      if (settled) return;

      settled = true;
      controller.abort();
      loader.stop();

      done(value);
    };

    container.addChild(new DynamicBorder((text: string) => theme.fg("border", text)));

    box.addChild(new Text(theme.bold(theme.fg("accent", "OpenAI Codex banked rate-limit resets")), 0, 0));
    box.addChild(loader);
    box.addChild(new Spacer(1));
    box.addChild(new Text(keyHint("tui.select.cancel", "cancel"), 0, 0));

    container.addChild(box);
    container.addChild(new DynamicBorder((text: string) => theme.fg("border", text)));

    loader.start();

    load(controller.signal).then((data) => {
      if (settled) return;

      loader.stop();

      const credits = data.credits.filter((credit) => credit.status === "available").toSorted((a, b) => getExpirationTime(a) - getExpirationTime(b));
      if (data.available_count === 0) {
        ctx.ui.notify("No Codex resets available", "info");
        finish(null);
        return;
      }
      if (credits.length === 0) {
        ctx.ui.notify(`${formatAvailableResets(data.available_count)}, but no reset details were returned`, "warning");
        finish(null);
        return;
      }

      box.clear();
      box.addChild(new Text(theme.bold(theme.fg("accent", "OpenAI Codex banked rate-limit resets")), 0, 0));
      box.addChild(new Text(renderCredits(theme, "", data.usage), 0, 0));
      box.addChild(new Spacer(1));

      const creditsById = new Map(credits.map((credit) => [credit.id, credit]));
      const items: SelectItem[] = credits.map((credit) => ({
        value: credit.id,
        label: formatCreditTitle(credit),
        description: formatCreditDescription(credit),
      }));

      selectList = new SelectList(items, Math.min(items.length, 10), {
        selectedPrefix: (text) => theme.fg("accent", text),
        selectedText: (text) => theme.fg("accent", text),
        description: (text) => theme.fg("muted", text),
        scrollInfo: (text) => theme.fg("dim", text),
        noMatch: (text) => theme.fg("warning", text),
      });
      selectList.onSelect = (item) => finish(creditsById.get(item.value) ?? null);
      selectList.onCancel = () => finish(null);

      box.addChild(selectList);
      box.addChild(new Spacer(1));

      const keyHints = [rawKeyHint("↑↓", "navigate"), keyHint("tui.select.confirm", "redeem"), keyHint("tui.select.cancel", "cancel")];
      box.addChild(new Text(keyHints.join("  "), 0, 0));

      tui.requestRender();
    }).catch((error) => {
      if (settled || controller.signal.aborted) return;

      ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      finish(null);
    });

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        if (selectList) {
          selectList.handleInput(data);
          tui.requestRender();
        } else if (matchesKey(data, "escape")) {
          finish(null);
        }
      },
    };
  });

  return selected ?? undefined;
}

export async function confirmCodexReset(ctx: ExtensionContext, credit: BankedRateLimitReset): Promise<boolean> {
  const confirmed = await ctx.ui.custom<boolean>((tui, theme, _keybindings, done) => {
    const container = new Container();
    container.addChild(new DynamicBorder((text: string) => theme.fg("border", text)));

    const box = new Box(1, 1);
    box.addChild(new Text(theme.bold(theme.fg("accent", "Redeem reset?")), 0, 0));
    box.addChild(new Spacer(1));

    const details = [
      formatCreditTitle(credit),
      formatCreditDescription(credit, false),
      credit.description?.trim(),
    ].filter(Boolean).join("\n");

    box.addChild(new Text(theme.fg("muted", details), 0, 0));
    box.addChild(new Spacer(1));
    box.addChild(new Text(theme.fg("warning", "This permanently consumes one banked reset and resets all eligible windows."), 0, 0));
    box.addChild(new Spacer(1));

    const items: SelectItem[] = [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ];

    const selectList = new SelectList(items, 2, {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    });
    selectList.onSelect = (item) => done(item.value === "yes");
    selectList.onCancel = () => done(false);

    box.addChild(selectList);
    box.addChild(new Spacer(1));

    const keyHints = [rawKeyHint("↑↓", "navigate"), keyHint("tui.select.confirm", "confirm"), keyHint("tui.select.cancel", "cancel")];
    box.addChild(new Text(keyHints.join("  "), 0, 0));

    container.addChild(box);
    container.addChild(new DynamicBorder((text: string) => theme.fg("border", text)));

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });

  return confirmed ?? false;
}

export async function showCodexResetLoader(ctx: ExtensionContext, run: () => Promise<void>): Promise<void> {
  await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
    const container = new Container();
    const loader = new Loader(tui, (text) => theme.fg("accent", text), (text) => theme.fg("muted", text), "Redeeming...");

    container.addChild(new DynamicBorder((text: string) => theme.fg("border", text)));

    const box = new Box(1, 1);
    box.addChild(new Text(theme.bold(theme.fg("accent", "OpenAI Codex banked rate-limit resets")), 0, 0));
    box.addChild(loader);

    container.addChild(box);
    container.addChild(new DynamicBorder((text: string) => theme.fg("border", text)));

    loader.start();

    run()
      .catch((error: unknown) => ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"))
      .finally(() => {
        loader.stop();
        done();
      });

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
    };
  });
}

export function formatAvailableResets(count: number): string {
  return `${count} ${count === 1 ? "reset" : "resets"} available`;
}

function formatCreditTitle(credit: BankedRateLimitReset): string {
  return credit.title?.trim() || "Banked rate-limit reset";
}

function formatCreditDescription(credit: BankedRateLimitReset, padEnd: boolean = true): string {
  const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));

  const granted = padEnd ? `Granted ${formatDate(credit.granted_at)}`.padEnd(DATE_COLUMN_WIDTH) : `Granted ${formatDate(credit.granted_at)}`;
  const expires = padEnd ? (credit.expires_at ? `Expires ${formatDate(credit.expires_at)}` : "No expiration").padEnd(DATE_COLUMN_WIDTH) : (credit.expires_at ? `Expires ${formatDate(credit.expires_at)}` : "No expiration");
  return `${granted} · ${expires}`;
}

function getExpirationTime(credit: BankedRateLimitReset): number {
  if (!credit.expires_at) return Number.POSITIVE_INFINITY;

  const timestamp = Date.parse(credit.expires_at);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}
