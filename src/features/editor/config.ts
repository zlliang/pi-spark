import * as z from "zod";

const thinkingLevelIndicatorSchema = z.enum(["border", "model"]);

export type ThinkingLevelIndicator = z.infer<typeof thinkingLevelIndicatorSchema>;

export const editorConfigSchema = z.object({
  thinkingLevelIndicator: thinkingLevelIndicatorSchema.optional(),
});
