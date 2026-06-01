import { completeSimple } from "@earendil-works/pi-ai";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

import { resolveRecapModel } from "./model";
import { clearRecapWidget, setRecapLoadingWidget, setRecapTextWidget } from "./widget";
import { sanitizeText } from "../shared/format";

import type { Api, Model, ModelThinkingLevel, SimpleStreamOptions, Usage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { RecapConfig } from "./config";

const SYSTEM_PROMPT = [
  "You write concise recaps for an idle terminal coding agent session.",
  "Summarize only what is supported by the transcript; do not invent progress, intent, files, or next steps.",
  "Focus on the user's goal, completed work, current state, and likely next step.",
  "Prefer recent context when the session changed direction.",
  "Output one short paragraph of 1-2 sentences. No heading, markdown, bullets, or quotes.",
].join("\n");

const MAX_TOKENS = 120;
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
      const recapModel = await resolveRecapModel(this.pi, ctx, this.config);
      if (controller.signal.aborted || this.inflight !== controller || !recapModel) return;

      setRecapLoadingWidget(ctx, recapModel.warning);
      this.active = false;

      const result = await this.generate(ctx, recapModel.model, recapModel.thinkingLevel, controller.signal);
      if (controller.signal.aborted || this.inflight !== controller) return;
      if (!result.content) {
        clearRecapWidget(ctx);
        return;
      }

      setRecapTextWidget(ctx, result.content, recapModel.warning);
      this.active = true;

      this.pi.appendEntry("recap", {
        provider: recapModel.model.provider,
        model: recapModel.model.id,
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
      "Create a short recap of this coding agent session for the user to see while the agent is idle.",
      "The transcript may be truncated from the beginning and may start mid-message; account for that uncertainty.",
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
