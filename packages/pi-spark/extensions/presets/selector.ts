import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, SelectList, Spacer, Text } from "@earendil-works/pi-tui";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PresetManager } from "./manager";

export async function showPresetSelector(ctx: ExtensionContext, presetManager: PresetManager): Promise<string | undefined> {
  if (presetManager.keys.length === 0) {
    ctx.ui.notify("No presets defined in spark.json", "warning");
    return undefined;
  }

  const selected = await ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
    const items = presetManager.keys
      .toSorted((a, b) => Number(presetManager.isActive(ctx, b)) - Number(presetManager.isActive(ctx, a)))
      .map((key) => ({
        value: key,
        label: presetManager.isActive(ctx, key) ? `${key} ${theme.fg("success", "✓")} ` : key,
        description: presetManager.describe(key),
      }));

    const container = new Container();

    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.bold("Select preset"), 0, 0));
    container.addChild(new Text(theme.fg("dim", "↑↓ navigate · enter select · esc cancel"), 0, 0));
    container.addChild(new Spacer(1));

    const selectList = new SelectList(items, 10, {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    });
    selectList.onSelect = (item) => done(item.value);
    selectList.onCancel = () => done(null);
    container.addChild(selectList);

    container.addChild(new Spacer(1));
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
      render: (width: number) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });

  return selected ?? undefined;
}
