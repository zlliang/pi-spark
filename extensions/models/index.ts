import { clampThinkingLevel, getSupportedThinkingLevels, StringEnum } from "@earendil-works/pi-ai";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, keyText, truncateHead } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { loadConfig } from "../shared/config";
import { formatModel } from "../shared/format";

import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI, TruncationResult } from "@earendil-works/pi-coding-agent";

/** Pi's built-in default thinking level, clamped per model. Not exported by pi's public API. */
const DEFAULT_THINKING_LEVEL: ModelThinkingLevel = "medium";

type ModelMetadata = Omit<Model<Api>, "headers" | "compat"> & {
  thinkingLevels: ModelThinkingLevel[];
  defaultThinkingLevel: ModelThinkingLevel;
};

type ModelToolDetails =
  | { action: "current"; current: { model: ModelMetadata; thinkingLevel: ModelThinkingLevel } }
  | { action: "list"; models: ModelMetadata[]; total: number; truncation?: TruncationResult }

function toMetadata(model: Model<Api>): ModelMetadata {
  const { headers: _headers, compat: _compat, ...metadata } = model;

  return {
    ...metadata,
    thinkingLevels: getSupportedThinkingLevels(model),
    defaultThinkingLevel: clampThinkingLevel(model, DEFAULT_THINKING_LEVEL),
  };
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx, "models");
    if (!config) return;

    pi.registerTool({
      name: "model",
      label: "model",
      description:
        "Inspect pi's model state. The \"current\" action returns the active model with metadata " +
        "and thinking level. The \"list\" action returns all models the user can use " +
        "currently (auth configured), including metadata such as provider, id, name, API type, " +
        "reasoning support, input modalities, cost, context window, and max output tokens. " +
        "Lists can be filtered with provider/model queries and paged with offset/limit. " +
        `List output is one JSON object per line, truncated to ${DEFAULT_MAX_LINES} models or ` +
        `${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
      promptSnippet: "List available models or show the current model in use",
      promptGuidelines: [
        "Use model when you need to know available pi models, the active provider or model, or the current thinking level.",
      ],
      parameters: Type.Object({
        action: StringEnum(["list", "current"] as const, {
          description:
            "\"list\" returns all currently usable models with metadata; " +
            "\"current\" returns the active model with metadata and thinking level.",
        }),
        provider: Type.Optional(Type.String({
          description: "For list: filter by provider, case-insensitive substring (e.g., \"vercel\", \"moonshot\")",
        })),
        model: Type.Optional(Type.String({
          description: "For list: filter by model id or display name, case-insensitive substring (e.g., \"claude\", \"deepseek\")",
        })),
        offset: Type.Optional(Type.Number({
          description: "For list: model number to start from (1-indexed)"
        })),
        limit: Type.Optional(Type.Number({
          description: "For list: maximum number of models to return"
        })),
      }),
      renderCall(args, theme, { expanded }) {
        let text = `${theme.bold(theme.fg("toolTitle", "model"))} ${theme.fg("accent", args.action)}`;

        if (args.provider) text += theme.fg("muted", ` provider:${args.provider}`);
        if (args.model) text += theme.fg("muted", ` model:${args.model}`);
        if (args.offset !== undefined || args.limit !== undefined) text += theme.fg("warning", ` from:${args.offset ?? 1}`);
        if (args.limit !== undefined) text += theme.fg("warning", ` to:${(args.offset ?? 1) + args.limit - 1}`);

        if (!expanded) text += theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);

        return new Text(text, 0, 0);
      },
      renderResult(result, { expanded }, theme, context) {
        const details = result.details as ModelToolDetails | undefined;

        const container = new Container();
        container.addChild(new Spacer(1));

        if (context.isError || !details) {
          const output = result.content
            .filter((content) => content.type === "text")
            .map((content) => content.text)
            .join("\n");
          container.addChild(new Text(theme.fg("error", output), 0, 0));

          return container;
        }

        if (details.action === "current") {
          const { model, thinkingLevel } = details.current;
          container.addChild(new Text(theme.fg("muted", formatModel(model.provider, model.id, thinkingLevel)), 0, 0));

          return container;
        }

        const filtered = context.args.provider !== undefined || context.args.model !== undefined;
        const models = details.models ?? [];
        const total = details.total ?? models.length;

        if (expanded) {
          models.forEach((model) => {
            container.addChild(new Text(theme.fg("muted", formatModel(model.provider, model.id)), 0, 0));
          });

          container.addChild(new Spacer(1));
        }

        const summary = `${models.length !== total ? `${models.length} of ` : ""}${total} ${filtered ? "matched" : "available"} model${total === 1 ? "" : "s"} listed`;
        container.addChild(new Text(theme.fg("muted", summary) + (details.truncation?.truncated ? theme.fg("warning", " (truncated)") : ""), 0, 0));

        return container;
      },
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (params.action === "current") {
          const model = ctx.model;
          if (!model) throw new Error("No model is currently selected.");

          const thinkingLevel = pi.getThinkingLevel();
          const current = { model: toMetadata(model), thinkingLevel };

          return {
            content: [{ type: "text", text: JSON.stringify(current) }],
            details: { action: "current", current } satisfies ModelToolDetails,
          };
        }

        const providerQuery = params.provider?.trim().toLowerCase();
        const modelQuery = params.model?.trim().toLowerCase();
        const filtered = providerQuery !== undefined || modelQuery !== undefined;

        const matched = ctx.modelRegistry.getAvailable().filter((model) => {
          if (providerQuery && !model.provider.toLowerCase().includes(providerQuery)) return false;
          if (modelQuery && !model.id.toLowerCase().includes(modelQuery) && !model.name.toLowerCase().includes(modelQuery)) return false;
          return true;
        }).map(toMetadata);
        const total = matched.length;

        if (total === 0) {
          return {
            content: [{ type: "text", text: `0 models ${filtered ? "matched" : "available"}.` }],
            details: { action: "list", models: [], total } satisfies ModelToolDetails,
          };
        }

        // Convert from 1-indexed offset to 0-indexed array access.
        const startIndex = params.offset ? Math.max(0, params.offset - 1) : 0;
        if (startIndex >= total) {
          throw new Error(`Offset ${params.offset} is beyond end of list (${total} models total).`);
        }

        const endIndex = params.limit !== undefined ? Math.min(startIndex + params.limit, total) : total;
        const selected = matched.slice(startIndex, endIndex);

        // JSONL: one compact object per line, so truncation cuts at record boundaries.
        const truncation = truncateHead(selected.map((model) => JSON.stringify(model)).join("\n"), {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES,
        });

        const delivered = truncation.truncated ? selected.slice(0, truncation.outputLines) : selected;
        const endDisplay = startIndex + delivered.length;
        const nextOffset = endDisplay + 1;

        let text = truncation.content;
        if (truncation.truncated) {
          text += `\n\n[Truncated: showing models ${startIndex + 1}-${endDisplay} of ${total}; use offset=${nextOffset} to continue]`;
        } else if (endDisplay < total) {
          text += `\n\n[${total - endDisplay} more models in list; use offset=${nextOffset} to continue]`;
        }

        return {
          content: [{ type: "text", text }],
          details: { action: "list", models: delivered, total, truncation } satisfies ModelToolDetails,
        };
      },
    });
  });
}
