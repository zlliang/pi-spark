import { BottomFiller } from "./filler";
import { loadConfig } from "../shared/config";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";

const WIDGET_KEY = "fullscreen";

export default function (pi: ExtensionAPI) {
  let tui: TUI | undefined;
  let pendingClear = false;

  /**
   * Mount a persistent filler above the editor. The widget factory receives the TUI handle
   * (otherwise unavailable via `ctx.ui`), so it both captures the TUI for clearing and pins the
   * editor and footer to the bottom of the screen.
   */
  function mountFiller(ctx: ExtensionContext): void {
    ctx.ui.setWidget(WIDGET_KEY, (capturedTui) => {
      tui = capturedTui;

      if (pendingClear) {
        pendingClear = false;
        queueMicrotask(() => capturedTui.requestRender(true));
      }

      return new BottomFiller(capturedTui);
    });
  }

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;

    const config = loadConfig(ctx, "fullscreen");
    if (!config) return;

    if (tui) {
      // Force a full repaint, which resets the TUI's diff state and clears the screen and
      // scrollback (`\x1b[2J\x1b[H\x1b[3J`), just like the built-in `clearOnShrink` behavior.
      tui.requestRender(true);
      return;
    }

    pendingClear = true;
    mountFiller(ctx);
  });
}
