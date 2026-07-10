import { completeSimple } from "@earendil-works/pi-ai/compat";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

import { sanitizeText } from "../../utils/format";
import { resolveModelSettings } from "../../utils/model";

import type { Api, Model, ModelThinkingLevel, SimpleStreamOptions, Usage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TitleConfig } from "./config";

const SYSTEM_PROMPT = [
  "You write a concise title for a terminal coding agent session.",
  "Base the title only on the transcript; do not invent topics, files, or intent.",
  "Capture the user's main goal or the session's central task.",
  "Respond in the conversation's primary language.",
  "Output a single title of 3-8 words. No trailing punctuation, quotes, markdown, or prefix like 'Title:'.",
].join(" ");

const MAX_TOKENS = 32;
const MAX_TITLE_CHARS = 80;
const MAX_CONVERSATION_CHARS = 8_000;

export class TitleManager {
  private pi: ExtensionAPI;
  private config: TitleConfig;
  private inflight: AbortController | undefined;

  constructor(pi: ExtensionAPI, config: TitleConfig) {
    this.pi = pi;
    this.config = config;
  }

  /** Generate and set the session title once, silently, from the current context. */
  async run(ctx: ExtensionContext): Promise<void> {
    if (this.pi.getSessionName()) return;

    this.cancelInflight();
    const controller = new AbortController();
    this.inflight = controller;

    try {
      const modelSettings = await resolveModelSettings(ctx, this.config, "title", { notifyOnMissingModel: false });
      if (controller.signal.aborted || this.inflight !== controller || !modelSettings) return;

      const { model, thinkingLevel } = modelSettings;
      const result = await this.generate(ctx, model, thinkingLevel, controller.signal);
      if (controller.signal.aborted || this.inflight !== controller || !result.content) return;

      this.pi.setSessionName(result.content);
      this.pi.appendEntry("title", {
        provider: model.provider,
        model: model.id,
        usage: result.usage,
        content: result.content,
      });
    } catch {
      // Title generation is best-effort and silent; ignore failures.
    } finally {
      if (this.inflight === controller) this.inflight = undefined;
    }
  }

  dispose(): void {
    this.cancelInflight();
  }

  private async generate(ctx: ExtensionContext, model: Model<Api>, thinkingLevel: ModelThinkingLevel, signal: AbortSignal): Promise<{ content: string; usage: Usage }> {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok) throw new Error(auth.error);

    const options: SimpleStreamOptions = {
      maxTokens: MAX_TOKENS,
      // Codex uses the session ID for request routing; without it, background calls may be
      // routed to an unavailable model.
      sessionId: ctx.sessionManager.getSessionId(),
      signal,
    };
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

    if (response.stopReason === "error") {
      throw new Error(response.errorMessage ?? "Title generation failed");
    }

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return { content: this.normalizeTitle(content), usage: response.usage };
  }

  private buildPrompt(ctx: ExtensionContext): string {
    const messages = ctx.sessionManager.getBranch().filter((entry) => entry.type === "message").map((entry) => entry.message);
    const text = serializeConversation(convertToLlm(messages));
    const conversation = text.length > MAX_CONVERSATION_CHARS ? text.slice(0, MAX_CONVERSATION_CHARS) : text;

    return [
      "Write a short title for this session, based on the transcript below.",
      "",
      "<conversation>",
      conversation,
      "</conversation>",
    ].join("\n");
  }

  private normalizeTitle(content: string): string {
    const title = sanitizeText(content).replace(/^["'`]+|["'`]+$/g, "").replace(/[.。!！?？]+$/g, "").trim();
    return title.length > MAX_TITLE_CHARS ? title.slice(0, MAX_TITLE_CHARS).trim() : title;
  }

  private cancelInflight(): void {
    this.inflight?.abort();
    this.inflight = undefined;
  }
}
