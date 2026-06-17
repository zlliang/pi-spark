import { keyHint, truncateHead } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { filter, parse } from "liqe";
import { Type } from "typebox";

import { defineAction } from "../registry";
import { formatListNotice, toMetadata, toModelRow } from "../model";

import type { TruncationResult } from "@earendil-works/pi-coding-agent";
import type { ModelMetadata, ModelRow } from "../model";

const LIST_MAX_LINES = 200;
const COLLAPSED_MAX_LINES = 10;

interface ModelsDetails {
  action: "models";
  models: ModelMetadata[];
  total: number;
  truncation?: TruncationResult;
}

export const modelsAction = defineAction({
  name: "models",
  summary: `lists and searches the model catalog (one JSON object per line, truncated to ${LIST_MAX_LINES} models)`,
  fields: {
    query: Type.Optional(Type.String({
      description:
        "For \"models\": Filter models with a Liqe (Lucene-like) query. Bare terms match any " +
        "field, and unquoted terms are case-insensitive substrings. The syntax supports " +
        "AND/OR/NOT, grouping, wildcards, and numeric comparisons; quote values containing " +
        "special characters (e.g., id:\"deepseek/deepseek-v4\"). Filterable fields are id, name, " +
        "provider, api, reasoning (boolean), input (modalities), cost.input and cost.output " +
        "(USD per 1M tokens), contextWindow, maxTokens, thinkingLevels, and available " +
        "(boolean, true when auth is configured). Examples: \"claude available:true\", " +
        "\"provider:openrouter cost.input:<1\".",
    })),
    offset: Type.Optional(Type.Number({ description: "For \"models\": Start from this model number (1-indexed)." })),
    limit: Type.Optional(Type.Number({ description: "For \"models\": Return at most this many models." })),
  },
  promptGuidelines: [
    "Use the pi tool's \"models\" action when you need metadata of pi models; include available:true in the query unless unavailable models are needed.",
  ],
  renderParams(args, theme) {
    const params: string[] = [];

    const query = args.query?.trim();
    if (query) params.push(theme.fg("muted", query));

    if (args.offset !== undefined || args.limit !== undefined) {
      const start = args.offset ?? 1;
      const end = args.limit !== undefined ? start + args.limit - 1 : "end";
      params.push(theme.fg("warning", `${start}-${end}`));
    }

    return params;
  },
  renderResult(result, { expanded }, theme, context) {
    const details = result.details as ModelsDetails | undefined;

    const container = new Container();
    container.addChild(new Spacer(1));

    if (!details) {
      container.addChild(new Text(theme.fg("muted", "No models found."), 0, 0));
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

    const filtered = Boolean(context.args.query?.trim());
    const models = details.models ?? [];
    const total = details.total ?? models.length;

    if (models.length > 0) {
      const maxRows = expanded ? models.length : Math.min(models.length, COLLAPSED_MAX_LINES);
      addRows(models.slice(0, maxRows).map((model) => toModelRow(model)));

      const hiddenRows = models.length - maxRows;
      if (hiddenRows > 0) container.addChild(new Text(theme.fg("muted", `... (${hiddenRows} more, `) + keyHint("app.tools.expand", "to expand") + theme.fg("muted", ")"), 0, 0));
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
  async execute(args, { ctx }) {
    const queryText = args.query?.trim();
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
        details: { action: "models", models: [], total } satisfies ModelsDetails,
      };
    }

    // Convert from 1-indexed offset to 0-indexed array access.
    const startIndex = args.offset ? Math.max(0, args.offset - 1) : 0;
    if (startIndex >= total) {
      throw new Error(`Offset ${args.offset} is beyond the end of the list (${total} models total)`);
    }

    const endIndex = args.limit !== undefined ? Math.min(startIndex + args.limit, total) : total;
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
      details: { action: "models", models: delivered, total, truncation } satisfies ModelsDetails,
    };
  },
});
