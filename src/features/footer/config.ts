import * as z from "zod";

const statusPositionSchema = z.enum(["inline", "below"]);

export type StatusPosition = z.infer<typeof statusPositionSchema>;

export const footerConfigSchema = z.object({
  statusPosition: statusPositionSchema.optional(),
});
