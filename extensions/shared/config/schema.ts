import * as z from "zod";

import { creditsConfigSchema } from "../../credits/config";
import { editorConfigSchema } from "../../editor/config";
import { footerConfigSchema } from "../../footer/config";
import { fullscreenConfigSchema } from "../../fullscreen/config";
import { nameConfigSchema } from "../../name/config";
import { presetsConfigSchema } from "../../presets/config";
import { recapConfigSchema } from "../../recap/config";

export const configSchemas = {
  credits: creditsConfigSchema,
  editor: editorConfigSchema,
  footer: footerConfigSchema,
  fullscreen: fullscreenConfigSchema,
  name: nameConfigSchema,
  presets: presetsConfigSchema,
  recap: recapConfigSchema,
};

export type ConfigField = keyof typeof configSchemas;
export type ConfigValue<Field extends ConfigField> = z.infer<(typeof configSchemas)[Field]>;
