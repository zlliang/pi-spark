import * as z from "zod";

export const codexUsageConfigSchema = z.object({});

export type CodexUsageConfig = z.infer<typeof codexUsageConfigSchema>;
