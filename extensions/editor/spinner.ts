import * as z from "zod";

import type { TUI } from "@earendil-works/pi-tui";

export const spinnerPresetSchema = z.enum(["dots", "lights", "tildes", "pulse"]);

type SpinnerPreset = z.infer<typeof spinnerPresetSchema>;

interface SpinnerParams {
  frames: string[];
  interval: number | { min: number; max: number };
  random: boolean;
}

const SPINNER_PRESETS: Record<SpinnerPreset, SpinnerParams> = {
  dots: {
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    interval: 80,
    random: false,
  },
  lights: {
    frames: ["○", "●"],
    interval: { min: 120, max: 240 },
    random: true,
  },
  tildes: {
    frames: ["∼", "≈", "≋", "≈", "∼"],
    interval: 200,
    random: false,
  },
  pulse: {
    frames: ["·", "•", "●", "•", "·"],
    interval: 100,
    random: false,
  },
};

const DEFAULT_SPINNER_PRESET = "tildes";

export class Spinner {
  private tui: TUI | undefined;

  private frames: string[];
  private interval: number | { min: number; max: number };
  private random: boolean;

  private working: boolean = false;
  private frameIndex: number = -1;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(preset: SpinnerPreset = DEFAULT_SPINNER_PRESET) {
    const params = SPINNER_PRESETS[preset];

    this.frames = params.frames;
    this.interval = params.interval;
    this.random = params.random;
  }

  setTUI(tui: TUI): void {
    this.tui = tui;
  }

  getFrame(): string {
    if (!this.working) return "";

    return this.frames[this.frameIndex] ?? "";
  }

  start(): void {
    this.stop();

    this.working = true;
    this.tick();
  }

  stop(): void {
    this.working = false;
    this.frameIndex = -1;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    this.tui?.requestRender();
  }

  dispose(): void {
    this.stop();
    this.tui = undefined;
  }

  private tick(): void {
    if (!this.working) return;

    this.frameIndex = this.random ? Math.floor(Math.random() * this.frames.length) : (this.frameIndex + 1) % this.frames.length;
    this.tui?.requestRender();

    const delay = typeof this.interval === "number" ? this.interval : this.interval.min + Math.floor(Math.random() * (this.interval.max - this.interval.min + 1));
    this.timer = setTimeout(() => this.tick(), delay);
  }
}
