import { createWriteToolDefinition, getLanguageFromPath, highlightCode, keyHint } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

import { loadConfig } from "../../config";
import { renderPath } from "./path";

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";

const PREVIEW_LINES = 10;
const HIGHLIGHT_LOOKBACK_LINES = 50;

function normalizeContent(content: string): string {
  return content.replace(/\r/g, "").replace(/\t/g, "   ");
}

class HighlightCache {
  private rawPath: string | null = null;
  private rawContent = "";
  private argsComplete = false;
  private language = "";
  private normalizedLines: string[] = [];
  private highlightedLines: string[] = [];

  update(rawPath: string | null, rawContent: string | null, argsComplete: boolean): string[] | undefined {
    if (rawContent === null) {
      this.clear();
      return undefined;
    }

    const language = rawPath ? getLanguageFromPath(rawPath) : undefined;
    if (!language) {
      this.clear();
      return undefined;
    }
    if (this.matches(rawPath, rawContent, argsComplete, language)) return this.highlightedLines;

    if (argsComplete || !this.canExtend(rawPath, rawContent, language)) {
      this.rebuild(rawPath, rawContent, argsComplete, language);
    } else {
      this.extend(rawContent);
    }

    return this.highlightedLines;
  }

  clear(): void {
    this.rawPath = null;
    this.rawContent = "";
    this.argsComplete = false;
    this.language = "";
    this.normalizedLines = [];
    this.highlightedLines = [];
  }

  private rebuild(rawPath: string | null, rawContent: string, argsComplete: boolean, language: string): void {
    const normalizedContent = normalizeContent(rawContent);
    this.rawPath = rawPath;
    this.rawContent = rawContent;
    this.argsComplete = argsComplete;
    this.language = language;
    this.normalizedLines = normalizedContent.split("\n");
    this.highlightedLines = highlightCode(normalizedContent, language);
  }

  private matches(rawPath: string | null, rawContent: string, argsComplete: boolean, language: string): boolean {
    return this.rawPath === rawPath && this.rawContent === rawContent && this.argsComplete === argsComplete && this.language === language;
  }

  private canExtend(rawPath: string | null, rawContent: string, language: string): boolean {
    return this.rawPath === rawPath && this.language === language && rawContent.startsWith(this.rawContent);
  }

  private extend(rawContent: string): void {
    const segments = normalizeContent(rawContent.slice(this.rawContent.length)).split("\n");
    const lastIndex = this.normalizedLines.length - 1;
    const start = Math.max(0, lastIndex - HIGHLIGHT_LOOKBACK_LINES);

    this.rawContent = rawContent;
    this.argsComplete = false;
    this.normalizedLines[lastIndex] += segments[0] ?? "";
    this.normalizedLines.push(...segments.slice(1));

    const highlightedLines = highlightCode(this.normalizedLines.slice(start).join("\n"), this.language);
    this.highlightedLines.splice(start, this.highlightedLines.length - start, ...highlightedLines);
  }
}

class WriteCallComponent extends Text {
  private highlightCache = new HighlightCache();

  constructor() {
    super("", 0, 0);
  }

  updateHighlight(rawPath: string | null, rawContent: string | null, argsComplete: boolean): string[] | undefined {
    return this.highlightCache.update(rawPath, rawContent, argsComplete);
  }

  override invalidate(): void {
    this.highlightCache.clear();
    super.invalidate();
  }
}

function parseArg(value: unknown): string | null {
  if (typeof value === "string") return value;
  return value == null ? "" : null;
}

function trimTrailingEmptyLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") end--;
  return lines.slice(0, end);
}

function renderOmission(hiddenLines: number, totalLines: number, theme: Theme): string {
  const summary = theme.fg("muted", `... (${hiddenLines} more lines, ${totalLines} total,`);
  return `${summary} ${keyHint("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`;
}

function formatWriteCall(path: string | null, content: string | null, highlightedLines: string[] | undefined, expanded: boolean, cwd: string, theme: Theme): string {
  const header = `${theme.fg("toolTitle", theme.bold("write"))} ${renderPath(path, cwd, theme)}`;
  if (content === null) return `${header}\n\n${theme.fg("error", "[invalid content arg - expected string]")}`;
  if (!content) return header;

  const language = path ? getLanguageFromPath(path) : undefined;
  const normalizedContent = normalizeContent(content);
  const contentLines = language ? (highlightedLines ?? highlightCode(normalizedContent, language)) : normalizedContent.split("\n");
  const lines = trimTrailingEmptyLines(contentLines);

  const visibleLines = expanded ? lines : lines.slice(-PREVIEW_LINES);
  const hiddenLines = lines.length - visibleLines.length;
  const displayLines = language ? visibleLines : visibleLines.map((line) => theme.fg("toolOutput", line));

  const body = hiddenLines > 0 ? [renderOmission(hiddenLines, lines.length, theme), ...displayLines] : displayLines;

  return [header, "", ...body].join("\n");
}

export function registerWrite(pi: ExtensionAPI): void {
  let enabled = true;
  const toolCache = new Map<string, ReturnType<typeof createWriteToolDefinition>>();

  function getWriteTool(cwd: string): ReturnType<typeof createWriteToolDefinition> {
    let tool = toolCache.get(cwd);
    if (!tool) {
      tool = createWriteToolDefinition(cwd);
      toolCache.set(cwd, tool);
    }

    return tool;
  };

  pi.on("session_start", (_event, ctx) => {
    enabled = loadConfig(ctx).write !== false;
  });

  pi.registerTool({
    ...getWriteTool(process.cwd()),
    execute(toolCallId, params, signal, onUpdate, ctx) {
      return getWriteTool(ctx.cwd).execute(toolCallId, params, signal, onUpdate, ctx);
    },
    renderCall(args, theme, context) {
      if (!enabled) return getWriteTool(context.cwd).renderCall!(args, theme, context);

      const renderArgs = args as { path?: string; file_path?: string; content?: string } | undefined;
      const path = parseArg(renderArgs?.file_path ?? renderArgs?.path);
      const content = parseArg(renderArgs?.content);

      const component = context.lastComponent instanceof WriteCallComponent ? context.lastComponent : new WriteCallComponent();
      const highlightedLines = component.updateHighlight(path, content, context.argsComplete);
      component.setText(formatWriteCall(path, content, highlightedLines, context.expanded, context.cwd, theme));

      return component;
    },
  });
}
