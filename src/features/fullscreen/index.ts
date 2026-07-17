import { VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

import { BottomFiller } from "./filler";
import { loadConfig } from "../../config";
import { sanitizeText } from "../../utils/format";

import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import type { UserMessage } from "@earendil-works/pi-ai";

const WIDGET_KEY = "fullscreen";

function getSessionDisplayText(ctx: ExtensionContext, theme: Theme): string | undefined {
  const sessionName = ctx.sessionManager.getSessionName();
  if (sessionName) return theme.fg("warning", sanitizeText(sessionName));

  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "message" || entry.message.role !== "user") continue;

    const text = extractText(entry.message);
    if (text) return sanitizeText(text);
  }

  return undefined;
}

function extractText(message: UserMessage): string {
  const content = message.content;
  if (typeof content === "string") return content;

  return content.filter((block) => block.type === "text").map((block) => block.text).join(" ");
}

export function registerFullscreen(pi: ExtensionAPI): void {
  let tui: TUI | undefined;
  let enabled = false;
  let pendingClear = false;

  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).fullscreen;
    if (!ctx.hasUI || !config) return;

    enabled = true;
    pendingClear = true;

    // The TUI handle isn't exposed via `ctx.ui`; the widget factory is the only place that
    // receives it. Mounting a persistent filler above the editor both captures the TUI and
    // pins the editor and footer to the bottom of the screen.
    ctx.ui.setWidget(WIDGET_KEY, (capturedTui) => {
      tui = capturedTui;

      const filler = new BottomFiller(capturedTui);
      const shouldClear = pendingClear;
      pendingClear = false;

      // Defer setup until `setWidget` has mounted the filler in the render tree.
      queueMicrotask(() => {
        filler.suppressIdleStatus();
        if (shouldClear) capturedTui.requestRender(true);
      });

      return filler;
    });
  });

  pi.on("session_shutdown", (event, ctx) => {
    if (!enabled) return;

    if (event.reason === "quit" && tui) {
      // The TUI is already stopped here, so write the clear sequence directly instead of
      // repainting: clear screen, home, clear scrollback.
      tui.terminal.write("\x1b[2J\x1b[H\x1b[3J");

      const theme = ctx.ui.theme;
      const exitMessage = `${theme.bold(theme.fg("accent", "pi"))} ${theme.fg("dim", `v${VERSION} exited`)}`;
      const sessionText = getSessionDisplayText(ctx, theme);
      const line = truncateToWidth(`${exitMessage}${sessionText ? `${theme.fg("dim", ":")} ${sessionText}` : ""}`, tui.terminal.columns, "…");
      tui.terminal.write(`${line}\r\n`);
    }

    ctx.ui.setWidget(WIDGET_KEY, undefined);
    tui = undefined;
    enabled = false;
    pendingClear = false;
  });
}
