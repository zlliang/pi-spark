import { visibleWidth } from "@earendil-works/pi-tui";

import { InlineText } from "./inline-text";

import type { Component } from "@earendil-works/pi-tui";

type Side = "left" | "right";

interface SplitLineOptions {
  padding?: number;
  gap?: number;
  innerPadding?: number;
  primarySide?: Side;
  spacingChar?: string;
  ellipsis?: string;
}

const DEFAULT_SPLIT_LINE_OPTIONS: Required<SplitLineOptions> = {
  padding: 0,
  gap: 2,
  innerPadding: 0,
  primarySide: "left",
  spacingChar: " ",
  ellipsis: "…",
};

/** Single-line component that places left and right text at opposite sides. */
export class SplitLine implements Component {
  private left: InlineText;
  private right: InlineText;

  private padding: number;
  private gap: number;
  private primarySide: Side;
  private spacingChar: string;

  constructor(left: InlineText | string, right: InlineText | string, options: SplitLineOptions = {}) {
    const spacingChar = options.spacingChar ?? DEFAULT_SPLIT_LINE_OPTIONS.spacingChar;
    if (visibleWidth(spacingChar) !== 1) throw new Error("spacingChar must have a visible width of 1");

    const inlineTextOptions = { padding: options.innerPadding ?? DEFAULT_SPLIT_LINE_OPTIONS.innerPadding, ellipsis: options.ellipsis ?? DEFAULT_SPLIT_LINE_OPTIONS.ellipsis };
    this.left = typeof left === "string" ? new InlineText(left, inlineTextOptions) : left;
    this.right = typeof right === "string" ? new InlineText(right, inlineTextOptions) : right;

    this.padding = options.padding ?? DEFAULT_SPLIT_LINE_OPTIONS.padding;
    this.gap = options.gap ?? DEFAULT_SPLIT_LINE_OPTIONS.gap;
    this.primarySide = options.primarySide ?? DEFAULT_SPLIT_LINE_OPTIONS.primarySide;
    this.spacingChar = spacingChar;
  }

  invalidate(): void {
    // No-op
  }

  render(width: number): [string] {
    const contentWidth = width - this.padding * 2;
    const content = this.renderContent(contentWidth);
    const paddingText = this.spacingChar.repeat(this.padding);

    return [`${paddingText}${content}${paddingText}`];
  }

  private renderContent(width: number): string {
    const [primary, secondary] = this.primarySide === "left" ? [this.left, this.right] : [this.right, this.left];

    const renderedPrimary = primary.render(width)[0];
    const renderedPrimaryWidth = visibleWidth(renderedPrimary);
    const secondaryWidth = renderedPrimaryWidth > 0 ? width - renderedPrimaryWidth - this.gap : width;
    const renderedSecondary = secondary.render(secondaryWidth)[0];

    const [renderedLeft, renderedRight] = this.primarySide === "left" ? [renderedPrimary, renderedSecondary] : [renderedSecondary, renderedPrimary];
    const spacingWidth = width - visibleWidth(renderedLeft) - visibleWidth(renderedRight);

    return `${renderedLeft}${this.spacingChar.repeat(spacingWidth)}${renderedRight}`;
  }
}
