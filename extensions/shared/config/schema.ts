import * as z from "zod";

import { creditsConfigSchema } from "../../credits/config";

export const configSchemas = {
  credits: creditsConfigSchema,
};

export type ConfigField = keyof typeof configSchemas;
export type ConfigValue<Field extends ConfigField> = z.infer<(typeof configSchemas)[Field]>;
