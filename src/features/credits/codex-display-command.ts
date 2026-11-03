import { loadConfig, saveCodexDisplay, SparkConfigUpdateError } from "../../config";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CodexDisplay } from "./config";

const OPTIONS: { value: CodexDisplay; label: string }[] = [
  { value: "both", label: "both — Rate limits and spend" },
  { value: "rate-limits", label: "rate-limits — Rate limits only, with spend fallback" },
  { value: "spend", label: "spend — Spend only, with rate-limit fallback" },
];

const SUBCOMMAND = "codex-display";
const USAGE = "/spark codex-display [both | rate-limits | spend]";

export function registerCodexDisplayCommand(
  pi: ExtensionAPI,
  onChange: (ctx: ExtensionContext, display: CodexDisplay) => Promise<void>,
): void {
  pi.registerCommand("spark", {
    description: `Configure pi-spark: ${USAGE} (saved and applied immediately)`,
    getArgumentCompletions: (prefix) => {
      const argument = prefix.trimStart();
      const match = /^codex-display\s+(.*)$/s.exec(argument);
      if (!match) {
        return SUBCOMMAND.startsWith(argument)
          ? [{ value: SUBCOMMAND, label: SUBCOMMAND, description: "Choose Codex rate-limit and spend display" }]
          : null;
      }
      const items = OPTIONS.filter((option) => option.value.startsWith(match[1]))
        .map((option) => ({ value: `${SUBCOMMAND} ${option.value}`, label: option.value, description: option.label }));
      return items.length > 0 ? items : null;
    },
    handler: async (args, ctx) => {
      const input = args.trim();
      const match = /^codex-display(?:\s+(.*))?$/s.exec(input);
      if (!match) {
        ctx.ui.notify(`Usage: ${USAGE}`, input ? "error" : "info");
        return;
      }

      const config = loadConfig(ctx).credits;
      if (!config) {
        ctx.ui.notify("Credits are disabled in spark.json.", "warning");
        return;
      }

      const value = (match[1] ?? "").trim();
      let choice = OPTIONS.find((option) => option.value === value);
      if (value && !choice) {
        ctx.ui.notify(`Usage: ${USAGE}`, "error");
        return;
      }

      if (!value) {
        if (!ctx.hasUI) {
          ctx.ui.notify("Specify a mode: /spark codex-display both, rate-limits, or spend.", "warning");
          return;
        }
        const current = config.codexDisplay ?? "both";
        const selected = await ctx.ui.select(`Codex display (current: ${current})`, OPTIONS.map((option) => option.label));
        choice = OPTIONS.find((option) => option.label === selected);
        if (!choice) return;
      }
      if (!choice) return;

      let scope: "global" | "project";
      try {
        scope = saveCodexDisplay(ctx, choice.value);
      } catch (error) {
        ctx.ui.notify(error instanceof SparkConfigUpdateError ? error.message : "Could not save Codex display settings.", "error");
        return;
      }

      await onChange(ctx, choice.value);
      ctx.ui.notify(`Codex display: ${choice.value} (saved ${scope === "global" ? "globally" : "for this workspace"}).`, "info");
    },
  });
}
