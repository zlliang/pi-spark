import Type from "typebox";
import { Parse } from "typebox/value";

import type { Static } from "typebox";

const PresetChangePayload = Type.Union([Type.String({ minLength: 1 }), Type.Undefined()]);

export const PRESET_CHANGE = "preset:change" as const;

export function parsePresetChange(data: unknown): Static<typeof PresetChangePayload> {
  return Parse(PresetChangePayload, data);
}
