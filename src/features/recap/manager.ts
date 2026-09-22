import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

import { clearRecapWidget, setRecapLoadingWidget, setRecapTextWidget } from "./widget";
import { sanitizeText } from "../../utils/format";
import { completeBackground, resolveModelSettings } from "../../utils/model";

import type { Api, Model, ModelThinkingLevel, Usage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { RecapConfig } from "./config";

const SYSTEM_PROMPT = [
  "You write concise idle session recaps for a terminal coding agent.",
  "Use only transcript-supported facts; do not invent progress, intent, files, or next steps.",
  "Prefer the latest active task if the session changed direction.",
  "Summarize the user's goal, what was done, current state, and any clearly supported next step.",
  "Respond in the conversation's primary language. Address the user in the second person.",
  "Output 1-2 plain-text sentences under 40 words. No heading, markdown, bullets, or quotes.",
].join(" ");

const MAX_TOKENS = 80;
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
    if (!options.force && (this.active || this.inflight || !ctx.isIdle())) return;

    this.cancelInflight();
    const controller = new AbortController();
    this.inflight = controller;

    try {
      const modelSettings = await resolveModelSettings(ctx, this.config, "recap");
      if (controller.signal.aborted || this.inflight !== controller || !modelSettings) return;
      if (!options.force && !ctx.isIdle()) return;

      const { model, thinkingLevel, warning } = modelSettings;

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
    const response = await completeBackground(ctx, model, {
      systemPrompt: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [{ type: "text", text: this.buildPrompt(ctx) }],
        timestamp: Date.now(),
      }],
    }, {
      maxTokens: MAX_TOKENS,
      signal,
      reasoning: thinkingLevel === "off" ? undefined : thinkingLevel,
    });

    if (response.stopReason === "error") {
      throw new Error(response.errorMessage ?? "Recap generation failed");
    }

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return { content: sanitizeText(content), usage: response.usage };
  }

  private buildPrompt(ctx: ExtensionContext): string {
    const messages = ctx.sessionManager.buildSessionProjection().messages;
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
