import { TitleManager } from "./manager";
import { loadConfig } from "../../config";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerTitle(pi: ExtensionAPI): void {
  let titleManager: TitleManager | undefined = undefined;

  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).title;
    if (!ctx.hasUI || !config) return;

    titleManager = new TitleManager(pi, config);
  });

  // Generate the title after the first exchange, once the session has context to summarize.
  // The manager runs at most once and skips sessions that already have a name.
  pi.on("agent_end", (_event, ctx) => {
    titleManager?.run(ctx);
  });

  pi.on("session_shutdown", () => {
    titleManager?.dispose();
    titleManager = undefined;
  });
}
