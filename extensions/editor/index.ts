import { CustomEditor } from "@earendil-works/pi-coding-agent";

import { Spinner } from "./spinner";
import { SplitLine } from "../shared/components/split-line";
import { loadConfig } from "../shared/config";
import { autoCollectEvents, PRESET_CHANGE, parsePresetChange } from "../shared/events";
import { formatModel, formatRunningTools } from "../shared/format";

import type { ExtensionAPI, ExtensionContext, KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { TUI, EditorTheme } from "@earendil-works/pi-tui";

class Editor extends CustomEditor {
  private pi: ExtensionAPI;
  private ctx: ExtensionContext;

  private spinner: Spinner;
  private workingMessage: string | undefined;
  private slots: { modelBefore: string | undefined };

  constructor(pi: ExtensionAPI, ctx: ExtensionContext, tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, spinner: Spinner = new Spinner()) {
    super(tui, theme, keybindings);

    this.pi = pi;
    this.ctx = ctx;

    this.spinner = spinner;
    this.spinner.setTUI(tui);
    this.workingMessage = undefined;
    this.slots = { modelBefore: undefined };
  }

  setWorkingMessage(message: string | undefined): void {
    this.workingMessage = message;
    this.tui.requestRender();
  }

  setSlot(slot: keyof typeof this.slots, value: string | undefined): void {
    this.slots[slot] = value;
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0) return lines;

    lines[0] = this.renderTopBorder(width);

    return lines;
  }

  private renderTopBorder(width: number): string {
    const theme = this.ctx.ui.theme;

    const left = this.getLeft();
    const right = this.getRight();

    return new SplitLine(left, right, {
      padding: 1,
      innerPadding: 1,
      spacingChar: this.borderColor("─"),
      ellipsis: theme.fg("dim", "…"),
    }).render(width)[0];
  }

  private getLeft(): string {
    const theme = this.ctx.ui.theme;

    const spinner = this.spinner.getFrame();
    const workingMessage = this.workingMessage;

    return [theme.fg("accent", spinner), workingMessage ? theme.fg("dim", workingMessage) : undefined].filter(Boolean).join(" ");
  }

  private getRight(): string {
    const theme = this.ctx.ui.theme;

    const modelBeforeText = this.slots.modelBefore;
    const modelText = formatModel(this.ctx.model?.provider, this.ctx.model?.id, this.pi.getThinkingLevel());

    return theme.fg("dim", [modelBeforeText, modelText].filter(Boolean).join(" • "));
  }
}

export default function (pi: ExtensionAPI) {
  const events = autoCollectEvents(pi);

  let editor: Editor | undefined = undefined;
  let spinner: Spinner | undefined = undefined;
  let runningToolCount = 0;

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;

    const config = loadConfig(ctx, "editor");
    if (!config) return;

    spinner = new Spinner(config.spinner);

    ctx.ui.setWorkingVisible(false);
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      editor = new Editor(pi, ctx, tui, theme, keybindings, spinner);

      events.on(PRESET_CHANGE, (data) => {
        const payload = parsePresetChange(data);
        editor?.setSlot("modelBefore", payload ? `preset:${payload}` : undefined);
      });

      return editor;
    });
  });

  pi.on("agent_start", () => {
    runningToolCount = 0;
    editor?.setWorkingMessage("Working");
    spinner?.start();
  });

  pi.on("message_update", (event) => {
    if (runningToolCount > 0) return;

    switch (event.assistantMessageEvent.type) {
      case "thinking_start":
      case "thinking_delta":
        editor?.setWorkingMessage("Thinking");
        break;
      case "text_start":
      case "text_delta":
        editor?.setWorkingMessage("Streaming");
        break;
      case "toolcall_start":
      case "toolcall_delta":
      case "toolcall_end":
        editor?.setWorkingMessage("Preparing tools");
        break;
      default:
        editor?.setWorkingMessage("Working");
        break;
    }
  });

  pi.on("tool_execution_start", () => {
    runningToolCount += 1;
    editor?.setWorkingMessage(formatRunningTools(runningToolCount));
  });

  pi.on("tool_execution_end", () => {
    runningToolCount = Math.max(0, runningToolCount - 1);
    editor?.setWorkingMessage(runningToolCount > 0 ? formatRunningTools(runningToolCount) : "Working");
  });

  pi.on("agent_end", () => {
    runningToolCount = 0;
    editor?.setWorkingMessage(undefined);
    spinner?.stop();
  });

  pi.on("session_shutdown", () => {
    runningToolCount = 0;
    editor = undefined;
    spinner?.dispose();
    spinner = undefined;
  });
}
