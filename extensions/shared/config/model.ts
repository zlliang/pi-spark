import * as z from "zod";

import type { ModelThinkingLevel } from "@earendil-works/pi-ai";

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const satisfies readonly ModelThinkingLevel[];

export const modelSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  thinkingLevel: z.enum(THINKING_LEVELS),
});

export const optionalModelSchema = modelSchema.partial();

export type OptionalModelConfig = z.infer<typeof optionalModelSchema>;
