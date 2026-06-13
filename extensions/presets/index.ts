import { Key } from "@earendil-works/pi-tui";

import { PresetManager } from "./manager";
import { showPresetSelector } from "./selector";
import { loadConfig } from "../shared/config";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let presetManager: PresetManager | undefined = undefined;

  pi.registerFlag("preset", {
    description: "Model preset to use",
    type: "string",
  });

  pi.on("session_start", async (event, ctx) => {
    const presetFlag = pi.getFlag("preset");

    const config = loadConfig(ctx, "presets");
    if (!config || Object.keys(config).length === 0) {
      if (presetFlag) ctx.ui.notify("No presets defined in spark.json", "warning");
      return;
    }

    presetManager = new PresetManager(pi, config);
    presetManager.sync(ctx);

    pi.registerCommand("preset", {
      description: "Switch model preset",
      getArgumentCompletions: (prefix: string) => {
        if (!presetManager) return null;

        const items = presetManager.keys
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ value: key, label: key, description: presetManager!.describe(key) }));

        return items.length > 0 ? items : null;
      },
      handler: async (args, ctx) => {
        if (!presetManager) return;

        const key = args.trim();
        if (key) {
          await presetManager.apply(key, ctx);
          return;
        }

        const selected = await showPresetSelector(ctx, presetManager);
        if (selected) {
          await presetManager.apply(selected, ctx);
        }
      },
    });

    if (presetFlag && typeof presetFlag === "string") {
      await presetManager.apply(presetFlag, ctx);
    }
  });

  pi.on("model_select", (_event, ctx) => {
    presetManager?.sync(ctx);
  });

  pi.on("thinking_level_select", (_event, ctx) => {
    presetManager?.sync(ctx);
  });

  pi.registerShortcut(Key.ctrlSuper("p"), {
    description: "Cycle model preset forward",
    handler: async (ctx) => {
      await presetManager?.cycle(ctx, "forward");
    },
  });

  pi.registerShortcut(Key.ctrlShiftSuper("p"), {
    description: "Cycle model preset backward",
    handler: async (ctx) => {
      await presetManager?.cycle(ctx, "backward");
    },
  });

  pi.on("session_shutdown", () => {
    presetManager = undefined;
  });
}
