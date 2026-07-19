import * as z from "zod";

const spinnerPresetSchema = z.enum(["dots", "lights", "tildes", "pulse"]);

export type SpinnerPreset = z.infer<typeof spinnerPresetSchema>;

export const editorConfigSchema = z.object({
  spinner: spinnerPresetSchema.optional(),
});
