import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hyperlink, Text } from "@earendil-works/pi-tui";

import { SplitLine } from "../../components/split-line";
import { loadConfig } from "../../config";
import { formatContextUsage, formatCost, formatCwd, sanitizeText } from "../../utils/format";
import { getEntryUsage } from "../../utils/usage";

import type { ExtensionContext, ExtensionAPI, ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import type { StatusPosition } from "./config";

const DEFAULT_STATUS_POSITION: StatusPosition = "inline";

class FooterComponent implements Component {
  private ctx: ExtensionContext;
  private theme: Theme;
  private footerData: ReadonlyFooterDataProvider;
  private statusPosition: StatusPosition;

  constructor(ctx: ExtensionContext, theme: Theme, footerData: ReadonlyFooterDataProvider, statusPosition: StatusPosition = DEFAULT_STATUS_POSITION) {
    this.ctx = ctx;
    this.theme = theme;
    this.footerData = footerData;
    this.statusPosition = statusPosition;
  }

  invalidate(): void {
    // No-op
  }

  render(width: number): string[] {
    const left = this.getLeft();
    const right = this.getRight();

    const lines = new SplitLine(left, right, { primarySide: "right", ellipsis: this.theme.fg("dim", "…") }).render(width);

    if (this.statusPosition === "below") {
      const statusesText = this.getStatusesText();
      if (statusesText) lines.push(...new Text(statusesText, 0, 0).render(width));
    }

    return lines;
  }

  private getLeft(): string {
    const cwd = this.ctx.sessionManager.getCwd();
    const url = pathToFileURL(resolve(cwd));
    const cwdText = hyperlink(formatCwd(cwd, homedir()), url.href);
    const branch = this.footerData.getGitBranch();
    const sessionName = this.ctx.sessionManager.getSessionName();

    return this.theme.fg("dim", [cwdText, branch, sessionName].filter(Boolean).join(" · "));
  }

  private getRight(): string {
    const statusesText = this.statusPosition === "inline" ? this.getStatusesText() : "";
    const styledCostText = this.getStyledCostText();
    const styledContextUsageText = this.getStyledContextUsageText();

    return [statusesText, styledCostText, styledContextUsageText].filter(Boolean).join(this.theme.fg("dim", " · "));
  }

  /** Get extension statuses, sorted by key alphabetically. */
  private getStatusesText(): string {
    const extensionStatuses = this.footerData.getExtensionStatuses();
    if (extensionStatuses.size === 0) return "";

    return Array.from(extensionStatuses.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, text]) => sanitizeText(text))
      .join(this.theme.fg("dim", " · "));
  }

  private getStyledCostText(): string {
    const totalCost = this.ctx.sessionManager.getEntries().reduce((acc, entry) => acc + (getEntryUsage(entry)?.cost.total ?? 0), 0);

    // Hide cost below half a cent, since it would render as $0.00.
    if (totalCost < 0.005) return "";

    const costText = formatCost(totalCost);

    if (totalCost > 20) return this.theme.fg("warning", costText);
    return this.theme.fg("dim", costText);
  }

  private getStyledContextUsageText(): string {
    const contextUsage = this.ctx.getContextUsage();
    const contextUsageText = formatContextUsage(contextUsage);
    const percent = contextUsage?.percent ?? null;

    if (percent && percent > 90) return this.theme.fg("error", contextUsageText);
    if (percent && percent > 70) return this.theme.fg("warning", contextUsageText);
    return this.theme.fg("dim", contextUsageText);
  }
}

export function registerFooter(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).footer;
    if (!ctx.hasUI || !config) return;

    ctx.ui.setFooter((_tui, theme, footerData) => new FooterComponent(ctx, theme, footerData, config.statusPosition));
  });
}
