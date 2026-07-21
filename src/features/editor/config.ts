import * as z from "zod";

const spinnerPresetSchema = z.enum(["dots", "lights", "tildes", "pulse"]);
const thinkingLevelIndicatorSchema = z.enum(["border", "model"]);

export type SpinnerPreset = z.infer<typeof spinnerPresetSchema>;
export type ThinkingLevelIndicator = z.infer<typeof thinkingLevelIndicatorSchema>;

export const editorConfigSchema = z.object({
  spinner: spinnerPresetSchema.optional(),
  thinkingLevelIndicator: thinkingLevelIndicatorSchema.optional(),
});
