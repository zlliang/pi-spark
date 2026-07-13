import parseDuration from "parse-duration";
import * as z from "zod";

const MIN_IDLE_MS = 5_000;

/** Accept a millisecond number or a human-readable duration (e.g., "3m"), normalized to milliseconds. */
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

type IdleTimeout = z.infer<typeof idleTimeoutSchema>;
type IdleHash = string | number | boolean;

const DEFAULT_IDLE_MS = 5 * 60 * 1000;
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

  constructor(computeStateHash: (ctx: T) => IdleHash, idleMs: IdleTimeout = DEFAULT_IDLE_MS, pollMs: number = POLL_MS) {
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
