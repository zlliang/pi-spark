import * as z from "zod";

const creditsProviderIdSchema = z.enum([
  "deepseek",
  "fireworks",
  "kimi-coding",
  "moonshotai",
  "moonshotai-cn",
  "openai-codex",
  "opencode-go",
  "openrouter",
  "vercel-ai-gateway",
]);

export type CreditsProviderId = z.infer<typeof creditsProviderIdSchema>;

const codexDisplaySchema = z.enum(["both", "rate-limits", "spend"]);
export type CodexDisplay = z.infer<typeof codexDisplaySchema>;

export const creditsConfigSchema = z.object({
  providers: z.partialRecord(creditsProviderIdSchema, z.boolean()).optional(),
  codexDisplay: codexDisplaySchema.optional(),
});

export type CreditsConfig = z.infer<typeof creditsConfigSchema>;
