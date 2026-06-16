import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { SplitLine } from "../../components/split-line";
import { loadConfig } from "../../config";
import { formatContextUsage, formatCost, formatCwd, linkText, sanitizeText } from "../../utils/format";
import { getEntryUsage } from "../../utils/usage";

import type { ExtensionContext, ExtensionAPI, ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";

class FooterComponent implements Component {
  private ctx: ExtensionContext;
  private theme: Theme;
  private footerData: ReadonlyFooterDataProvider;

  constructor(ctx: ExtensionContext, theme: Theme, footerData: ReadonlyFooterDataProvider) {
    this.ctx = ctx;
    this.theme = theme;
    this.footerData = footerData;
  }

  invalidate(): void {
    // No-op
  }

  render(width: number): string[] {
    const left = this.getLeft();
    const right = this.getRight();

    return new SplitLine(left, right, { primarySide: "right", ellipsis: this.theme.fg("dim", "…") }).render(width);
  }

  private getLeft(): string {
    const cwd = this.ctx.sessionManager.getCwd();
    const url = pathToFileURL(resolve(cwd));
    const cwdText = linkText(formatCwd(cwd, homedir()), url.href);
    const branch = this.footerData.getGitBranch();
    const sessionName = this.ctx.sessionManager.getSessionName();

    return this.theme.fg("dim", [cwdText, branch, sessionName].filter(Boolean).join(" · "));
  }

  private getRight(): string {
    const statusesText = this.getStatusesText();
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
    const totalCost = this.ctx.sessionManager.getBranch().reduce((acc, entry) => acc + (getEntryUsage(entry)?.cost.total ?? 0), 0);
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

    ctx.ui.setFooter((_tui, theme, footerData) => new FooterComponent(ctx, theme, footerData));
  });
}
