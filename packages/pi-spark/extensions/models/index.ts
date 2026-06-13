import { clampThinkingLevel, getSupportedThinkingLevels, StringEnum } from "@earendil-works/pi-ai";
import { keyText, truncateHead } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { filter, parse } from "liqe";
import { Type } from "typebox";

import { loadConfig } from "../shared/config";
import { formatModel, formatTokens } from "../shared/format";

import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI, TruncationResult } from "@earendil-works/pi-coding-agent";

/** Pi's built-in default thinking level, clamped per model. Not exported by pi's public API. */
const DEFAULT_THINKING_LEVEL: ModelThinkingLevel = "medium";

/** Maximum number of models returned per list call; byte size is unrestricted. */
const LIST_MAX_LINES = 200;

/** Maximum number of model rows shown when the result is collapsed. */
const COLLAPSED_MAX_ROWS = 10;

type ModelMetadata = Omit<Model<Api>, "headers" | "compat"> & {
  thinkingLevels: ModelThinkingLevel[];
  defaultThinkingLevel: ModelThinkingLevel;
  available: boolean;
};

type ModelToolDetails =
  | { action: "active"; active: { model: ModelMetadata; thinkingLevel: ModelThinkingLevel } }
  | { action: "list"; models: ModelMetadata[]; total: number; truncation?: TruncationResult }

/** One display row of model metadata: label, cost per 1M tokens, and context window. */
type ModelRow = {
  label: string;
  cost: string;
  context: string;
  available: boolean;
};

function toMetadata(model: Model<Api>, available: boolean): ModelMetadata {
  const { headers: _headers, compat: _compat, ...metadata } = model;

  return {
    ...metadata,
    thinkingLevels: getSupportedThinkingLevels(model),
    defaultThinkingLevel: clampThinkingLevel(model, DEFAULT_THINKING_LEVEL),
    available,
  };
}

function toModelRow(model: ModelMetadata, thinkingLevel?: ModelThinkingLevel): ModelRow {
  return {
    label: formatModel(model.provider, model.id, thinkingLevel),
    cost: `$${formatPrice(model.cost.input)}/$${formatPrice(model.cost.output)}`,
    context: formatTokens(model.contextWindow),
    available: model.available,
  };
}

/** Round to at most 2 decimals and trim float noise: 0.7999... -> 0.8, 0.0983 -> 0.1, 15 -> 15. */
function formatPrice(value: number): string {
  return String(parseFloat(value.toFixed(2)));
}

/** Notice line describing truncation or remaining pages, shared by the text result and the TUI. */
function formatListNotice(truncated: boolean, startIndex: number, endDisplay: number, total: number): string | undefined {
  const nextOffset = endDisplay + 1;

  if (truncated) return `[Truncated: showing models ${startIndex + 1}-${endDisplay} of ${total}. Use offset=${nextOffset} to continue.]`;
  if (endDisplay < total) return `[${total - endDisplay} more models in list. Use offset=${nextOffset} to continue.]`;

  return undefined;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx, "models");
    if (!config) return;

    pi.registerTool({
      name: "model",
      label: "model",
      description:
        "Show the active model or list pi models. \"active\" returns the active model with " +
        "metadata and thinking level. \"list\" returns models with metadata such as provider, id, name, " +
        "API type, reasoning support, cost, context window, thinking levels, and availability, " +
        "filterable with a Liqe (Lucene-like) query and paged with offset/limit. List output is " +
        `one JSON object per line, truncated to ${LIST_MAX_LINES} models.`,
      promptSnippet: "Show the active model or list pi models",
      promptGuidelines: [
        "Use the model tool when you need pi model metadata, the active model, or the thinking level, rather than guessing.",
        "When listing models with the model tool, include available:true in the query unless unavailable models are explicitly needed.",
      ],
      parameters: Type.Object({
        action: StringEnum(["active", "list"] as const, {
          description: "\"active\" shows the active model; \"list\" lists the model catalog.",
        }),
        query: Type.Optional(Type.String({
          description:
            "For list: filter models with a Liqe (Lucene-like) query. Bare terms match any " +
            "field, and unquoted terms are case-insensitive substrings. The syntax supports " +
            "AND/OR/NOT, grouping, wildcards, and numeric comparisons; quote values containing " +
            "special characters (e.g., id:\"deepseek/deepseek-v4\"). Queryable fields are id, " +
            "name, provider, api, reasoning (boolean), input (modalities), cost.input and " +
            "cost.output (USD per 1M tokens), contextWindow, maxTokens, thinkingLevels, and " +
            "available (boolean, true when auth is configured). The catalog is large, so " +
            "include available:true unless every model is needed (e.g., \"claude " +
            "available:true\", \"provider:openrouter cost.input:<1\").",
        })),
        offset: Type.Optional(Type.Number({
          description: "For list: start from this model number (1-indexed)."
        })),
        limit: Type.Optional(Type.Number({
          description: "For list: return at most this many models."
        })),
      }),
      renderCall(args, theme) {
        let text = `${theme.bold(theme.fg("toolTitle", "model"))} ${theme.fg("accent", args.action)}`;

        if (args.action === "list") {
          const query = args.query?.trim();
          if (query) text += theme.fg("muted", ` ${query}`);

          if (args.offset !== undefined || args.limit !== undefined) {
            const start = args.offset ?? 1;
            const end = args.limit !== undefined ? start + args.limit - 1 : "end";
            text += theme.fg("warning", ` ${start}-${end}`);
          }
        }

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

        const addRows = (rows: ModelRow[]) => {
          const widths = {
            label: Math.max(...rows.map((row) => row.label.length)),
            cost: Math.max(...rows.map((row) => row.cost.length)),
            context: Math.max(...rows.map((row) => row.context.length)),
          };

          for (const row of rows) {
            const cells = [
              row.label.padEnd(widths.label),
              row.cost.padStart(widths.cost),
              row.context.padStart(widths.context),
            ].join("  ");
            const noAuthHint = row.available ? "" : theme.fg("dim", "  (no auth)");
            container.addChild(new Text(theme.fg("muted", cells) + noAuthHint, 0, 0));
          }
        };

        if (details.action === "active") {
          const { model, thinkingLevel } = details.active;
          addRows([toModelRow(model, thinkingLevel)]);

          return container;
        }

        const filtered = Boolean(context.args.query?.trim());
        const models = details.models ?? [];
        const total = details.total ?? models.length;

        if (models.length > 0) {
          const maxRows = expanded ? models.length : Math.min(models.length, COLLAPSED_MAX_ROWS);
          addRows(models.slice(0, maxRows).map((model) => toModelRow(model)));

          const hiddenRows = models.length - maxRows;
          if (hiddenRows > 0) container.addChild(new Text(theme.fg("dim", `... (${hiddenRows} more, ${keyText("app.tools.expand")} to expand)`), 0, 0));
          container.addChild(new Spacer(1));
        }

        if (details.truncation?.truncated) {
          const startIndex = context.args.offset ? Math.max(0, context.args.offset - 1) : 0;
          const endDisplay = startIndex + models.length;
          const notice = formatListNotice(true, startIndex, endDisplay, total);
          if (notice) {
            container.addChild(new Text(theme.fg("warning", notice), 0, 0));
            container.addChild(new Spacer(1));
          }
        }

        const summary = `${models.length !== total ? `${models.length} of ` : ""}${total} ${filtered ? "matched " : ""}model${total === 1 ? "" : "s"} listed.`;
        container.addChild(new Text(theme.fg("muted", total > 0 ? summary : `No models ${filtered ? "matched" : "found"}.`), 0, 0));

        return container;
      },
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (params.action === "active") {
          const model = ctx.model;
          if (!model) throw new Error("No model is active.");

          const thinkingLevel = pi.getThinkingLevel();
          const active = { model: toMetadata(model, true), thinkingLevel };

          return {
            content: [{ type: "text", text: JSON.stringify(active) }],
            details: { action: "active", active } satisfies ModelToolDetails,
          };
        }

        const queryText = params.query?.trim();
        const filtered = Boolean(queryText);

        let listQuery = null;
        if (queryText) {
          try {
            listQuery = parse(queryText);
          } catch (error) {
            throw new Error(`Invalid Liqe query ${JSON.stringify(queryText)}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        const models = ctx.modelRegistry.getAll().map((model) => toMetadata(model, ctx.modelRegistry.hasConfiguredAuth(model)));
        const matched = listQuery ? filter(listQuery, models) : models;
        const total = matched.length;

        if (total === 0) {
          return {
            content: [{ type: "text", text: `No models ${filtered ? "matched" : "found"}.` }],
            details: { action: "list", models: [], total } satisfies ModelToolDetails,
          };
        }

        // Convert from 1-indexed offset to 0-indexed array access.
        const startIndex = params.offset ? Math.max(0, params.offset - 1) : 0;
        if (startIndex >= total) {
          throw new Error(`Offset ${params.offset} is beyond the end of the list (${total} models total).`);
        }

        const endIndex = params.limit !== undefined ? Math.min(startIndex + params.limit, total) : total;
        const selected = matched.slice(startIndex, endIndex);

        // JSONL: one compact object per line, so truncation cuts at record boundaries.
        const truncation = truncateHead(selected.map((model) => JSON.stringify(model)).join("\n"), {
          maxLines: LIST_MAX_LINES,
          maxBytes: Infinity,
        });

        const delivered = truncation.truncated ? selected.slice(0, truncation.outputLines) : selected;
        const endDisplay = startIndex + delivered.length;

        let text = truncation.content;
        const notice = formatListNotice(truncation.truncated, startIndex, endDisplay, total);
        if (notice) text += `\n\n${notice}`;

        return {
          content: [{ type: "text", text }],
          details: { action: "list", models: delivered, total, truncation } satisfies ModelToolDetails,
        };
      },
    });
  });
}
