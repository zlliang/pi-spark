import * as z from "zod";

import { modelSchema } from "../shared/config/model";

export const presetsConfigSchema = z.record(z.string().min(1), modelSchema);

export type PresetsConfig = z.infer<typeof presetsConfigSchema>;
export type PresetConfig = PresetsConfig[string];
