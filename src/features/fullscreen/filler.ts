import type { Component, TUI } from "@earendil-works/pi-tui";

const FILLER_MARKER = "\0pi-spark:fullscreen\0";

/** Pins the editor and footer to the bottom when the rest of the UI is shorter than the terminal. */
export class BottomFiller implements Component {
  private tui: TUI;
  private active = false;
  private restore?: () => void;

  constructor(tui: TUI) {
    this.tui = tui;
  }

  /**
   * Install the layout after Pi has added this component to its widget container.
   *
   * Pi has no flexible spacer or layout-measurement API. The filler therefore emits a temporary
   * marker during Pi's normal render pass. A root render wrapper replaces that marker afterward,
   * when the total height is known. Every component, including the transcript, renders only once.
   */
  mount(): void {
    if (this.active) return;

    const widgetIndex = this.tui.children.findIndex((child) => "children" in child && Array.isArray(child.children) && child.children.includes(this));
    if (widgetIndex <= 0) return;

    const statusContainer = this.tui.children[widgetIndex - 1];
    if (!statusContainer) return;

    const originalStatusRender = statusContainer.render;
    const patchedStatusRender = (width: number): string[] => {
      const lines = originalStatusRender.call(statusContainer, width);
      if (!this.active) return lines;

      // Fullscreen already keeps the layout stable, so Pi's two idle placeholder rows only add an
      // unwanted gap above the editor. Real status indicators are left untouched.
      const blankLine = " ".repeat(width);
      return lines.length === 2 && lines.every((line) => line === blankLine) ? [] : lines;
    };

    const originalTuiRender = this.tui.render;
    const patchedTuiRender = (width: number): string[] => {
      const lines = originalTuiRender.call(this.tui, width);
      if (!this.active) return lines;

      const markerIndex = lines.indexOf(FILLER_MARKER);
      if (markerIndex === -1) return lines;

      lines.splice(markerIndex, 1);
      const fillerHeight = Math.max(0, this.tui.terminal.rows - lines.length);
      if (fillerHeight > 0) lines.splice(markerIndex, 0, ...new Array<string>(fillerHeight).fill(""));

      // Pi reads this after render() and may reset it to the configured value on startup/reload.
      this.tui.setClearOnShrink(true);
      return lines;
    };

    this.active = true;
    statusContainer.render = patchedStatusRender;
    this.tui.render = patchedTuiRender;

    this.restore = () => {
      if (this.tui.render === patchedTuiRender) this.tui.render = originalTuiRender;
      if (statusContainer.render === patchedStatusRender) statusContainer.render = originalStatusRender;
    };
  }

  dispose(): void {
    this.active = false;
    this.restore?.();
    this.restore = undefined;
  }

  invalidate(): void {
    // No cached render state
  }

  render(_width: number): string[] {
    return this.active ? [FILLER_MARKER] : [];
  }
}
