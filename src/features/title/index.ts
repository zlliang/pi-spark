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

  // Generate the title after the first completed turn, without waiting for the full agent run.
  // The manager skips sessions that already have a name and prevents concurrent attempts.
  pi.on("turn_end", (_event, ctx) => {
    void titleManager?.run(ctx);
  });

  // Fall back to settlement if the run ends without a completed turn or an early attempt fails.
  pi.on("agent_settled", (_event, ctx) => {
    void titleManager?.run(ctx);
  });

  pi.on("session_shutdown", () => {
    titleManager?.dispose();
    titleManager = undefined;
  });
}
