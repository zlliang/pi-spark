import * as z from "zod";

const creditsProviderIdSchema = z.enum([
  "deepseek",
  "fireworks",
  "kimi-coding",
  "moonshotai",
  "moonshotai-cn",
  "openai-codex",
  "openrouter",
  "vercel-ai-gateway",
]);

export type CreditsProviderId = z.infer<typeof creditsProviderIdSchema>;

export const creditsConfigSchema = z.object({
  providers: z.partialRecord(creditsProviderIdSchema, z.boolean()).optional(),
});

export type CreditsConfig = z.infer<typeof creditsConfigSchema>;
