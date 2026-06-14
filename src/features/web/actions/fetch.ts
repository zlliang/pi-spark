import { Type } from "typebox";

import { defineAction } from "../registry";
import { renderWebResult } from "../render";

interface FetchDetails {
  action: "fetch";
}

export const fetchAction = defineAction({
  name: "fetch",
  summary: "reads the full content of known URLs as clean markdown",
  showTiming: true,
  fields: {
    urls: Type.Optional(Type.Array(Type.String(), {
      description: "For \"fetch\": List the URLs to read. Batch multiple URLs in one call.",
    })),
    maxCharacters: Type.Optional(Type.Number({
      description: "For \"fetch\": Extract at most this many characters per page (default 3000).",
    })),
  },
  promptGuidelines: [
    "Use the web tool's \"fetch\" action to read full content from known URLs, batching multiple URLs in one call, especially when search highlights are insufficient.",
  ],
  renderParams(args, theme) {
    const params: string[] = [];

    if (args.urls && args.urls.length > 0) params.push(theme.fg("muted", args.urls.join(", ")));
    if (args.maxCharacters !== undefined) params.push(theme.fg("warning", `<= ${args.maxCharacters} chars`));

    return params;
  },
  renderResult(result, { expanded }, theme) {
    return renderWebResult(result, expanded, theme);
  },
  async execute(args, { exa }, signal) {
    if (!(args.urls && args.urls.length > 0)) {
      throw new Error("The \"fetch\" action requires a non-empty \"urls\" array");
    }

    const requestArgs: Record<string, unknown> = { urls: args.urls };
    if (args.maxCharacters !== undefined) requestArgs.maxCharacters = args.maxCharacters;

    const content = await exa.call("web_fetch_exa", requestArgs, signal);
    return { content, details: { action: "fetch" } satisfies FetchDetails };
  },
});
