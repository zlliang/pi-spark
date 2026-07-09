import * as z from "zod";

import { optionalModelSchema } from "../../config/model";

export const titleConfigSchema = optionalModelSchema;

export type TitleConfig = z.infer<typeof titleConfigSchema>;
