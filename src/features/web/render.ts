import { keyHint } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";

import { joinTextContent } from "../../utils/format";

import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";

const COLLAPSED_MAX_LINES = 10;

/**
 * Render a web result's text content with collapse-to-expand behavior. Shared by the `search` and
 * `fetch` actions, which both return plain text content. Errors are handled by the registry's
 * fallback renderer, so this only covers the success path.
 */
export function renderWebResult(result: AgentToolResult<unknown>, expanded: boolean, theme: Theme): Container {
  const container = new Container();
  container.addChild(new Spacer(1));

  const text = joinTextContent(result.content);
  const lines = text.length > 0 ? text.split("\n") : [];

  if (lines.length === 0) {
    container.addChild(new Text(theme.fg("muted", "No content returned."), 0, 0));
    return container;
  }

  const maxLines = expanded ? lines.length : Math.min(lines.length, COLLAPSED_MAX_LINES);
  container.addChild(new Text(theme.fg("muted", lines.slice(0, maxLines).join("\n")), 0, 0));

  const hidden = lines.length - maxLines;
  if (hidden > 0) container.addChild(new Text(theme.fg("dim", `... (${hidden} more lines, `) + keyHint("app.tools.expand", "to expand") + theme.fg("dim", ")"), 0, 0));

  return container;
}
