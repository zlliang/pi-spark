import * as z from "zod";

const presetChangePayloadSchema = z.string().min(1).optional();

export const PRESET_CHANGE = "preset:change" as const;

export function parsePresetChange(data: unknown): z.infer<typeof presetChangePayloadSchema> {
  return presetChangePayloadSchema.parse(data);
}
