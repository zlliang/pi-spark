import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { loadConfig } from "../shared/config";
import { sanitizeText } from "../shared/format";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;

    const config = loadConfig(ctx, "name");
    if (!config) return;

    pi.registerTool({
      name: "name",
      label: "name",
      description:
        "Name or rename the current session. The name is a concise label shown in the session " +
        "selector instead of the first-message preview.",
      promptSnippet: "Name or rename the current session",
      promptGuidelines: [
        "Use the name tool when the session needs a concise, recognizable label, especially after a long, vague, or pasted opening prompt.",
        "Use the name tool to rename the session only after a substantial shift in the conversation's focus, not for minor follow-ups.",
        "Use the name tool with a reason when it helps explain why the name identifies the session.",
      ],
      parameters: Type.Object({
        name: Type.String({
          minLength: 1,
          maxLength: 120,
          description:
            "Use a short, recognizable phrase in sentence case, ideally <= 72 characters " +
            "(e.g., \"Refactor auth module\", \"Debug flaky CI pipeline\"). Do not use " +
            "surrounding quotes, trailing punctuation, or generic prefixes like \"Chat about\".",
        }),
        reason: Type.Optional(Type.String({
          maxLength: 240,
          description:
            "Explain briefly why the session was named or renamed, such as a long pasted " +
            "prompt, an ambiguous first message, or a topic shift. Write one user-facing " +
            "sentence (e.g., \"The focus shifted from debugging to README updates.\").",
        })),
      }),
      renderCall(args, theme) {
        const name = sanitizeText(args.name);
        const reason = sanitizeText(args.reason ?? "");

        const container = new Container();
        container.addChild(new Text(`${theme.bold(theme.fg("toolTitle", "name"))} ${theme.fg("accent", name)}`, 0, 0));

        if (reason) {
          container.addChild(new Spacer(1));
          container.addChild(new Text(theme.fg("muted", reason), 0, 0));
        }

        return container;
      },
      renderResult(result, _options, theme, context) {
        const output = result.content
          .filter((content) => content.type === "text")
          .map((content) => content.text)
          .join("\n");

        return new Text(context.isError ? theme.fg("error", "\n" + output) : "", 0, 0);
      },
      async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
        const name = sanitizeText(params.name);
        if (!name) throw new Error("Session name was empty after normalization; provide a short, non-empty phrase.");

        const previous = pi.getSessionName() ?? null;
        if (previous === name) {
          return {
            content: [{ type: "text", text: `Session is already named "${name}". Nothing changed.` }],
            details: { changed: false, previous },
          };
        }

        pi.setSessionName(name);

        return {
          content: [{ type: "text", text: `${previous ? `Renamed session from "${previous}" to "${name}".` : `Named session "${name}".`}` }],
          details: { changed: true, previous },
        };
      },
    });
  });
}
