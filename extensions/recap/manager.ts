import { completeSimple } from "@earendil-works/pi-ai";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

import { resolveRecapModelSettings } from "./model";
import { clearRecapWidget, setRecapLoadingWidget, setRecapTextWidget } from "./widget";
import { sanitizeText } from "../shared/format";

import type { Api, Model, ModelThinkingLevel, SimpleStreamOptions, Usage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { RecapConfig } from "./config";

const SYSTEM_PROMPT = [
  "You write concise idle-session recaps for a terminal coding agent.",
  "Use only transcript-supported facts; do not invent progress, intent, files, or next steps.",
  "Prefer the latest active task if the session changed direction.",
  "Summarize the user's goal, what was done, current state, and any clearly supported next step.",
  "Respond in the conversation's primary language.",
  "Output 1-2 plain-text sentences under 80 words. No heading, markdown, bullets, or quotes.",
].join("\n");

const MAX_TOKENS = 100;
const MAX_CONVERSATION_CHARS = 8_000;

export class RecapManager {
  private pi: ExtensionAPI;
  private config: RecapConfig;
  private inflight: AbortController | undefined;
  private active = false;

  constructor(pi: ExtensionAPI, config: RecapConfig) {
    this.pi = pi;
    this.config = config;
  }

  async run(ctx: ExtensionContext, options: { force?: boolean } = {}): Promise<void> {
    if (this.active && !options.force) return;

    this.cancelInflight();
    const controller = new AbortController();
    this.inflight = controller;

    try {
      const recapModelSettings = await resolveRecapModelSettings(this.pi, ctx, this.config);
      if (controller.signal.aborted || this.inflight !== controller || !recapModelSettings) return;

      const { model, thinkingLevel, warning } = recapModelSettings;

      setRecapLoadingWidget(ctx, warning);
      this.active = false;

      const result = await this.generate(ctx, model, thinkingLevel, controller.signal);
      if (controller.signal.aborted || this.inflight !== controller) return;
      if (!result.content) {
        clearRecapWidget(ctx);
        return;
      }

      setRecapTextWidget(ctx, result.content, warning);
      this.active = true;

      this.pi.appendEntry("recap", {
        provider: model.provider,
        model: model.id,
        usage: result.usage,
        content: result.content,
      });
    } catch (error) {
      if (controller.signal.aborted || this.inflight !== controller) return;

      const message = error instanceof Error ? error.message : String(error);
      setRecapTextWidget(ctx, "Unable to generate recap.", message);
      this.active = false;
    } finally {
      if (this.inflight === controller) this.inflight = undefined;
    }
  }

  clear(ctx: ExtensionContext): void {
    this.cancelInflight();
    clearRecapWidget(ctx);
    this.active = false;
  }

  private async generate(ctx: ExtensionContext, model: Model<Api>, thinkingLevel: ModelThinkingLevel, signal: AbortSignal): Promise<{ content: string; usage: Usage }> {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) throw new Error(auth.error);

    const options: SimpleStreamOptions = { maxTokens: MAX_TOKENS, signal };
    if (auth.apiKey) options.apiKey = auth.apiKey;
    if (auth.headers) options.headers = auth.headers;
    if (thinkingLevel !== "off") options.reasoning = thinkingLevel;

    const response = await completeSimple(model, {
      systemPrompt: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [{ type: "text", text: this.buildPrompt(ctx) }],
        timestamp: Date.now(),
      }],
    }, options);

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return { content: sanitizeText(content), usage: response.usage };
  }

  private buildPrompt(ctx: ExtensionContext): string {
    const messages = ctx.sessionManager.getBranch().filter((entry) => entry.type === "message").map((entry) => entry.message);
    const text = serializeConversation(convertToLlm(messages));
    const conversation = text.length > MAX_CONVERSATION_CHARS ? text.slice(-MAX_CONVERSATION_CHARS) : text;

    return [
      "Create a short recap from this transcript, ordered oldest to newest.",
      "It may be truncated from the beginning; focus on the latest coherent task.",
      "",
      "<conversation>",
      conversation,
      "</conversation>",
    ].join("\n");
  }

  private cancelInflight(): void {
    this.inflight?.abort();
    this.inflight = undefined;
  }
}
