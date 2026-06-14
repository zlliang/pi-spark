import { Type } from "typebox";

import { defineAction } from "../registry";
import { renderWebResult } from "../render";

interface SearchDetails {
  action: "search";
}

export const searchAction = defineAction({
  name: "search",
  summary: "finds current information across the web and returns ready-to-use content",
  fields: {
    query: Type.Optional(Type.String({
      description:
        "For \"search\": Provide the search query. Use a semantically rich description of the " +
        "ideal page, not just keywords. Optionally include category:<type> (company, people) " +
        "to focus results.",
    })),
    numResults: Type.Optional(Type.Number({
      description: "For \"search\": Return at most this many search results (default 10).",
    })),
  },
  promptGuidelines: [
    "Use the web tool's \"search\" action for current information, news, facts, people, or companies; describe the ideal page rather than keywords (e.g., \"blog post comparing React and Vue performance\").",
  ],
  renderParams(args, theme) {
    const params: string[] = [];

    const query = args.query?.trim();
    if (query) params.push(theme.fg("muted", query));
    if (args.numResults !== undefined) params.push(theme.fg("warning", `${args.numResults} results`));

    return params;
  },
  renderResult(result, { expanded }, theme) {
    return renderWebResult(result, expanded, theme);
  },
  async execute(args, { exa }, signal) {
    const query = args.query?.trim();
    if (!query) throw new Error("The \"search\" action requires a non-empty \"query\"");

    const requestArgs: Record<string, unknown> = { query };
    if (args.numResults !== undefined) requestArgs.numResults = args.numResults;

    const content = await exa.call("web_search_exa", requestArgs, signal);
    return { content, details: { action: "search" } satisfies SearchDetails };
  },
});
