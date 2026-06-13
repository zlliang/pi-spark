import { VERSION } from "@earendil-works/pi-coding-agent";

import { BottomFiller } from "./filler";
import { loadConfig } from "../shared/config";
import { sanitizeText } from "../shared/format";

import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

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

export default function (pi: ExtensionAPI) {
  let tui: TUI | undefined;
  let enabled = false;
  let pendingClear = false;

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;

    const config = loadConfig(ctx, "fullscreen");
    if (!config) return;

    enabled = true;
    pendingClear = true;

    // The TUI handle isn't exposed via `ctx.ui`; the widget factory is the only place that
    // receives it. Mounting a persistent filler above the editor both captures the TUI and
    // pins the editor and footer to the bottom of the screen.
    ctx.ui.setWidget(WIDGET_KEY, (capturedTui) => {
      tui = capturedTui;

      // Defer the entry clear to a microtask: the filler isn't in the render tree until
      // `setWidget` returns, and `session_start` has no TUI to repaint with yet.
      if (pendingClear) {
        pendingClear = false;
        queueMicrotask(() => capturedTui.requestRender(true));
      }

      return new BottomFiller(capturedTui);
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

    tui = undefined;
    enabled = false;
    pendingClear = false;
  });
}
