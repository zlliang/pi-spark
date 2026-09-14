import { IdleListener } from "./idle";
import { RecapManager } from "./manager";
import { loadConfig } from "../../config";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export function registerRecap(pi: ExtensionAPI): void {
  let idleListener: IdleListener | undefined = undefined;
  let recapManager: RecapManager | undefined = undefined;

  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).recap;
    if (ctx.mode !== "tui" || !config) return;

    recapManager = new RecapManager(pi, config);

    pi.registerCommand("recap", {
      description: "Generate a short recap of the current session",
      handler: async (_args, ctx) => await recapManager?.run(ctx, { force: true }),
    });

    idleListener = new IdleListener(config.idle);
    idleListener.on("enter", (ctx) => recapManager?.run(ctx));
    idleListener.on("reset", (ctx) => recapManager?.clear(ctx));

    idleListener.reset(ctx);
  });

  pi.on("input", (_event, ctx) => {
    idleListener?.reset(ctx);
  });

  pi.on("user_bash", (_event, ctx) => {
    idleListener?.reset(ctx);
  });

  pi.on("agent_start", (_event, ctx) => {
    idleListener?.reset(ctx);
  });

  pi.on("session_before_compact", (_event, ctx) => {
    idleListener?.reset(ctx);
  });

  pi.on("session_before_tree", (_event, ctx) => {
    idleListener?.reset(ctx);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    recapManager?.clear(ctx);
    recapManager = undefined;

    idleListener?.dispose();
    idleListener = undefined;
  });
}
