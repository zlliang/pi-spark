import Type from "typebox";

import type { Static } from "typebox";

export const IdleTimeoutSchema = Type.Number({ minimum: 5000 });

type IdleTimeout = Static<typeof IdleTimeoutSchema>;
type IdleHash = string | number | boolean;

const POLL_MS = 1_000;

export class IdleListener<T> {
  private state: "active" | "watching" | "idle" = "active";
  private computeStateHash: (ctx: T) => IdleHash;
  private lastStateHash: IdleHash | undefined;

  private idleMs: number;
  private pollMs: number;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  private enterCallbacks: Set<(ctx: T) => void> = new Set();
  private wakeCallbacks: Set<(ctx: T) => void> = new Set();

  constructor(computeStateHash: (ctx: T) => IdleHash, idleMs: IdleTimeout = 60_000, pollMs: number = POLL_MS) {
    this.computeStateHash = computeStateHash;
    this.idleMs = idleMs;
    this.pollMs = pollMs;
  }

  on(event: "enter" | "wake", callback: (ctx: T) => void): () => void {
    const callbackSet = event === "enter" ? this.enterCallbacks : this.wakeCallbacks;
    callbackSet.add(callback);

    return () => callbackSet.delete(callback);
  }

  watch(ctx: T): void {
    if (this.state === "idle") return;

    this.stop();
    this.state = "watching";

    this.lastStateHash = this.computeStateHash(ctx);
    this.reset(ctx);

    this.pollTimer = setInterval(() => {
      const current = this.computeStateHash(ctx);
      if (current === this.lastStateHash) return;

      this.lastStateHash = current;
      this.reset(ctx);
    }, this.pollMs);
  }

  enter(ctx: T): void {
    if (this.state === "idle") return;

    this.stop();
    this.state = "idle";

    this.enterCallbacks.forEach((callback) => callback(ctx));
  }

  /** Emit on every wake signal, even when the listener is already active. */
  wake(ctx: T): void {
    this.stop();
    this.state = "active";

    this.wakeCallbacks.forEach((callback) => callback(ctx));
  }

  dispose(): void {
    this.stop();
    this.state = "active";

    this.enterCallbacks.clear();
    this.wakeCallbacks.clear();
  }

  private reset(ctx: T): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      this.enter(ctx);
    }, this.idleMs);
  }

  private stop(): void {
    this.clearIdleTimer();
    this.clearPollTimer();
  }

  private clearIdleTimer(): void {
    if (!this.idleTimer) return;

    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private clearPollTimer(): void {
    if (!this.pollTimer) return;

    clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }
}
