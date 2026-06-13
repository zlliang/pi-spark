import type { Component, TUI } from "@earendil-works/pi-tui";

/**
 * Fills the gap above the editor so the editor and footer stay pinned to the
 * bottom of the terminal when the session content is shorter than one screen.
 */
export class BottomFiller implements Component {
  private tui: TUI;
  private measuring = false;

  constructor(tui: TUI) {
    this.tui = tui;
  }

  invalidate(): void {
    // No-op
  }

  render(width: number): string[] {
    // Guard against re-entrancy: measuring the siblings below renders this component again.
    if (this.measuring) return [];
    this.measuring = true;

    // Re-assert `clearOnShrink` every render pass; the TUI reads it after `render()` returns,
    // so this wins deterministically over pi's reset to the settings value on startup/reload.
    this.tui.setClearOnShrink(true);

    const rows = this.tui.terminal.rows;
    let others = 0;
    for (const child of this.tui.children) {
      others += child.render(width).length;
      if (others >= rows) break;
    }

    this.measuring = false;
    return new Array(Math.max(0, rows - others)).fill("");
  }
}
