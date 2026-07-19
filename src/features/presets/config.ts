import * as z from "zod";

import { modelSchema } from "../../config/model";

export type PresetConfig = z.infer<typeof modelSchema>;

export const presetsConfigSchema = z.record(z.string().min(1), modelSchema);

export type PresetsConfig = z.infer<typeof presetsConfigSchema>;
