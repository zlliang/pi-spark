import * as z from "zod";

import { spinnerPresetSchema } from "./spinner";

export const editorConfigSchema = z.object({
  spinner: spinnerPresetSchema.optional(),
});
