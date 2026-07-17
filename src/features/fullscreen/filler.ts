import type { Component, TUI } from "@earendil-works/pi-tui";

/**
 * Fills the gap above the editor so the editor and footer stay pinned to the
 * bottom of the terminal when the session content is shorter than one screen.
 */
export class BottomFiller implements Component {
  private tui: TUI;
  private measuring = false;
  private statusContainer?: Component;
  private originalStatusRender?: Component["render"];
  private patchedStatusRender?: Component["render"];

  constructor(tui: TUI) {
    this.tui = tui;
  }

  /**
   * Suppress Pi's two-line idle status placeholder while leaving active status
   * indicators and `clearOnShrink` unchanged.
   *
   * Pi added the placeholder to prevent status indicators from shrinking the TUI in
   * [#6026](https://github.com/earendil-works/pi/pull/6026). Fullscreen already stabilizes short
   * layouts with this filler, while in long layouts the placeholder surfaces as blank space above
   * the editor. This render wrapper specifically counteracts that placeholder without hiding real
   * statuses.
   */
  suppressIdleStatus(): void {
    if (this.patchedStatusRender) return;

    const widgetIndex = this.tui.children.findIndex((child) => "children" in child && Array.isArray(child.children) && child.children.includes(this));
    if (widgetIndex <= 0) return;

    const statusContainer = this.tui.children[widgetIndex - 1];
    if (!statusContainer) return;

    const originalRender = statusContainer.render;
    const patchedRender = (width: number): string[] => {
      const lines = originalRender.call(statusContainer, width);
      return lines.length === 2 && lines.every((line) => line === " ".repeat(width)) ? [] : lines;
    };

    statusContainer.render = patchedRender;
    this.statusContainer = statusContainer;
    this.originalStatusRender = originalRender;
    this.patchedStatusRender = patchedRender;
  }

  dispose(): void {
    const statusContainer = this.statusContainer;
    const originalStatusRender = this.originalStatusRender;
    if (statusContainer && originalStatusRender && statusContainer.render === this.patchedStatusRender) {
      statusContainer.render = originalStatusRender;
    }
  }

  invalidate(): void {
    // No-op
  }

  render(width: number): string[] {
    // Guard against re-entrancy: measuring the siblings below renders this component again.
    if (this.measuring) return [];
    this.measuring = true;

    // Re-assert `clearOnShrink` every render pass; the TUI reads it after `render()` returns,
    // so this wins deterministically over Pi's reset to the settings value on startup/reload.
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
