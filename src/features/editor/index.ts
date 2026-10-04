import { CustomEditor } from "@earendil-works/pi-coding-agent";

import { SplitLine } from "../../components/split-line";
import { loadConfig } from "../../config";
import { PRESET_CHANGE, parsePresetChange } from "../../events";
import { formatModel } from "../../utils/format";

import type { ExtensionAPI, ExtensionContext, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { TUI, EditorTheme } from "@earendil-works/pi-tui";
import type { EventCollector } from "../../events";
import type { ThinkingLevelIndicator } from "./config";

type StatusIndicator = NonNullable<Parameters<CustomEditor["setWorkingStatusIndicator"]>[0]>;

class Editor extends CustomEditor {
  private pi: ExtensionAPI;
  private ctx: ExtensionContext;

  private thinkingLevelIndicator: ThinkingLevelIndicator;
  private statusIndicator: StatusIndicator | undefined;
  private slots: { modelBefore: string | undefined };

  constructor(pi: ExtensionAPI, ctx: ExtensionContext, tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, thinkingLevelIndicator: ThinkingLevelIndicator = "border") {
    super(tui, theme, keybindings, { embedWorkingStatus: true });

    this.pi = pi;
    this.ctx = ctx;

    this.thinkingLevelIndicator = thinkingLevelIndicator;
    this.statusIndicator = undefined;
    this.slots = { modelBefore: undefined };
  }

  /** Receives Pi's working, retry, compaction, and branch summary indicators for the top border. */
  override setWorkingStatusIndicator(indicator: StatusIndicator | undefined): void {
    this.statusIndicator = indicator;
  }

  setSlot(slot: keyof typeof this.slots, value?: string | undefined): void {
    this.slots[slot] = value;
    this.tui.requestRender();
  }

  override render(width: number): string[] {
    // Pi reapplies the thinking-level border color when the level changes. Use the dim color here
    // while preserving Bash mode's dedicated border color. Set it before rendering, since the
    // border helpers below run inside `super.render()`.
    if (this.thinkingLevelIndicator === "model" && !this.getText().trimStart().startsWith("!")) {
      this.borderColor = (text) => this.ctx.ui.theme.fg("dim", text);
    }

    return super.render(width);
  }

  protected override renderTopBorder(width: number, hiddenLineCount: number): string {
    return this.renderBorder(width, this.getTopLeft(width, hiddenLineCount), this.getTopRight());
  }

  protected override renderBottomBorder(width: number, hiddenLineCount: number): string {
    return this.renderBorder(width, this.getScrollHint("↓", hiddenLineCount), "");
  }

  private renderBorder(width: number, left: string, right: string): string {
    const theme = this.ctx.ui.theme;

    return new SplitLine(left, right, {
      padding: 1,
      innerPadding: 1,
      spacingChar: this.borderColor("─"),
      ellipsis: theme.fg("dim", "…"),
    }).render(width)[0];
  }

  private getTopLeft(width: number, hiddenLineCount: number): string {
    const theme = this.ctx.ui.theme;

    return [this.getScrollHint("↑", hiddenLineCount), this.statusIndicator?.renderInBorder(width)].filter(Boolean).join(theme.fg("dim", " · "));
  }

  private getTopRight(): string {
    const theme = this.ctx.ui.theme;

    const modelBeforeText = this.slots.modelBefore;
    const modelText = formatModel(this.ctx.model?.provider, this.ctx.model?.id, this.pi.getThinkingLevel());
    const coloredModelText = this.thinkingLevelIndicator === "model" ? this.withThinkingLevelColor(modelText) : theme.fg("dim", modelText);

    return [modelBeforeText ? theme.fg("dim", modelBeforeText) : undefined, coloredModelText].filter(Boolean).join(theme.fg("dim", " · "));
  }

  /** Renders Pi's hidden-line hint, which this editor keeps on the left side of the border. */
  private getScrollHint(direction: "↑" | "↓", hiddenLineCount: number): string {
    if (hiddenLineCount <= 0) return "";

    return this.ctx.ui.theme.fg("dim", `${direction} ${hiddenLineCount} more`);
  }

  private withThinkingLevelColor(text: string): string {
    const theme = this.ctx.ui.theme;
    const thinkingLevel = this.pi.getThinkingLevel();

    return theme.getThinkingBorderColor(thinkingLevel)(text);
  }
}

export function registerEditor(pi: ExtensionAPI, events: EventCollector): void {
  let editor: Editor | undefined = undefined;

  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).editor;
    if (ctx.mode !== "tui" || !config) return;

    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      editor = new Editor(pi, ctx, tui, theme, keybindings, config.thinkingLevelIndicator);

      events.on(PRESET_CHANGE, (data) => {
        const payload = parsePresetChange(data);
        editor?.setSlot("modelBefore", payload ? ctx.ui.theme.bold(payload) : undefined);
      });

      return editor;
    });
  });

  pi.on("session_shutdown", () => {
    editor = undefined;
  });
}
