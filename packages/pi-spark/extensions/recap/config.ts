import * as z from "zod";

import { idleTimeoutSchema } from "./idle";
import { optionalModelSchema } from "../shared/config/model";

export const recapConfigSchema = optionalModelSchema.extend({
  idle: idleTimeoutSchema.optional(),
});

export type RecapConfig = z.infer<typeof recapConfigSchema>;
