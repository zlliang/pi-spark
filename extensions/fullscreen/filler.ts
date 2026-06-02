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
    // The TUI renders this component as part of its child tree, so measuring the
    // siblings re-enters this render. Guard against the recursion and count our
    // own contribution as zero lines while measuring.
    if (this.measuring) return [];
    this.measuring = true;

    const rows = this.tui.terminal.rows;
    let others = 0;
    for (const child of this.tui.children) {
      others += child.render(width).length;
      if (others >= rows) break; // content already fills the screen
    }

    this.measuring = false;
    return new Array(Math.max(0, rows - others)).fill("");
  }
}
