import * as z from "zod";

import { creditsConfigSchema } from "../features/credits/config";
import { editorConfigSchema } from "../features/editor/config";
import { footerConfigSchema } from "../features/footer/config";
import { fullscreenConfigSchema } from "../features/fullscreen/config";
import { presetsConfigSchema } from "../features/presets/config";
import { recapConfigSchema } from "../features/recap/config";
import { titleConfigSchema } from "../features/title/config";
import { writeConfigSchema } from "../features/write/config";

/**
 * Raw option shape for each feature. The enable/disable/default policy lives in `loadConfig`:
 * an omitted field falls back to `{}` (enabled with defaults), `false` disables the feature, and
 * any other value is validated against the feature schema.
 */
export const featureSchemas = {
  credits: creditsConfigSchema,
  editor: editorConfigSchema,
  footer: footerConfigSchema,
  fullscreen: fullscreenConfigSchema,
  presets: presetsConfigSchema,
  recap: recapConfigSchema,
  title: titleConfigSchema,
  write: writeConfigSchema,
} as const;

/** Resolved config for every feature; `false` means the feature is disabled. */
export type SparkConfig = {
  [K in keyof typeof featureSchemas]: z.infer<(typeof featureSchemas)[K]> | false;
};
