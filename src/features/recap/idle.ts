import parseDuration from "parse-duration";
import * as z from "zod";
import { convertToLlm } from "@earendil-works/pi-coding-agent";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const MIN_IDLE_MS = 5_000;

/** Accepts a millisecond number or a human-readable duration (e.g., "3m"), normalized to milliseconds. */
export const idleTimeoutSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === "number") return value;

    const parsed = parseDuration(value);
    if (parsed !== null) return parsed;

    ctx.addIssue({ code: "custom", message: `Value is not a valid duration. value=${JSON.stringify(value)}` });
    return z.NEVER;
  })
  .pipe(z.number().min(MIN_IDLE_MS));

const DEFAULT_IDLE_MS = 5 * 60 * 1000;
const POLL_MS = 1_000;

export class IdleListener {
  private entered = false;
  private lastEditorText: string | undefined;
  private stableSince = 0;
  private idleMs: number;
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  private enterCallbacks: Set<(ctx: ExtensionContext) => void> = new Set();
  private resetCallbacks: Set<(ctx: ExtensionContext) => void> = new Set();

  constructor(idleMs: number = DEFAULT_IDLE_MS) {
    this.idleMs = idleMs;
  }

  on(event: "enter" | "reset", callback: (ctx: ExtensionContext) => void): () => void {
    const callbacks = event === "enter" ? this.enterCallbacks : this.resetCallbacks;
    callbacks.add(callback);

    return () => callbacks.delete(callback);
  }

  /** Clears any recap and starts a fresh idle period, keeping observation active while Pi is busy. */
  reset(ctx: ExtensionContext): void {
    this.entered = false;
    this.lastEditorText = undefined;
    this.resetCallbacks.forEach((callback) => callback(ctx));

    this.check(ctx);
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => this.check(ctx), POLL_MS);
    }
  }

  dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    this.entered = false;
    this.lastEditorText = undefined;
    this.enterCallbacks.clear();
    this.resetCallbacks.clear();
  }

  private check(ctx: ExtensionContext): void {
    const canEnter = ctx.isIdle() && convertToLlm(ctx.sessionManager.buildSessionProjection().messages).some((message) => message.role !== "system");
    if (!canEnter) {
      this.lastEditorText = undefined;
      if (this.entered) {
        this.entered = false;
        this.resetCallbacks.forEach((callback) => callback(ctx));
      }
      return;
    }

    // Keep the recap while the user edits; only a reset or Pi becoming busy clears it.
    if (this.entered) return;

    const editorText = ctx.ui.getEditorText();
    const now = Date.now();
    if (editorText !== this.lastEditorText) {
      this.lastEditorText = editorText;
      this.stableSince = now;
      return;
    }

    if (now - this.stableSince >= this.idleMs) {
      this.entered = true;
      this.enterCallbacks.forEach((callback) => callback(ctx));
    }
  }
}
