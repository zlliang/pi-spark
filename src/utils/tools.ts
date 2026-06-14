import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { joinTextContent } from "./format";

import type { AgentToolResult, ExtensionAPI, ExtensionContext, Theme, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Static, TObject, TProperties, TSchema } from "typebox";

interface ActionDetails {
  action: string;
}

/**
 * One action of a composed tool. The registry merges every action's `fields` into one flat object
 * schema (provider-safe, unlike a discriminated union; see the StringEnum note in pi's extension
 * docs) and dispatches by `action`. `C` is the per-call context the host feature builds via
 * `ComposedToolConfig.createContext`.
 */
export interface Action<C, F extends TProperties = TProperties, D extends ActionDetails = ActionDetails> {
  name: D["action"];
  summary: string;
  fields: F;
  /** Fields required at runtime, since the flat schema makes every action's fields optional. */
  required?: (keyof F & string)[];
  promptGuidelines?: string[];
  /** Styled segments shown after the `<tool> <action>` prefix in the call line. */
  renderParams?: (args: Static<TObject<F>>, theme: Theme) => string[];
  renderResult?: NonNullable<ToolDefinition<TObject<F>, D>["renderResult"]>;
  execute(args: Static<TObject<F>>, context: C, signal: AbortSignal | undefined): Promise<AgentToolResult<D>>;
}

/**
 * Build an identity helper bound to a context type `C`. Each feature creates one
 * (`const defineAction = defineActionFor<MyContext>()`) so its actions infer their own field and
 * details types while sharing a single context shape.
 */
export function defineActionFor<C>() {
  return <F extends TProperties, D extends ActionDetails>(action: Action<C, F, D>): Action<C, F, D> => action;
}

interface ComposedToolConfig<C> {
  name: string;
  label: string;
  descriptionIntro: string;
  descriptionOutro?: string;
  promptSnippet: string;
  generalGuidelines?: string[];
  actions: Action<C, any, any>[];
  createContext(ctx: ExtensionContext): C;
}

export function registerComposedTool<C>(pi: ExtensionAPI, config: ComposedToolConfig<C>): void {
  const byName = new Map<string, Action<C, any, any>>();
  const mergedFields: TProperties = {};

  for (const action of config.actions) {
    if (byName.has(action.name)) throw new Error(`Duplicate "${config.name}" action "${action.name}"`);
    byName.set(action.name, action);

    for (const [key, schema] of Object.entries(action.fields)) {
      if (key === "action") throw new Error(`"${config.name}" action "${action.name}" must not define a field named "action"`);
      if (key in mergedFields) throw new Error(`"${config.name}" action "${action.name}" redefines field "${key}"; field names must be unique across actions`);
      mergedFields[key] = Type.Optional(schema as TSchema);
    }
  }

  const summaries = config.actions.map((action) => `"${action.name}" ${action.summary}`).join("; ");
  const description = config.descriptionOutro
    ? `${config.descriptionIntro} ${summaries}. ${config.descriptionOutro}`
    : `${config.descriptionIntro} ${summaries}.`;

  const parameters = Type.Object({
    action: StringEnum(config.actions.map((action) => action.name), { description: `The ${config.name} action to run.` }),
    ...mergedFields,
  });

  pi.registerTool({
    name: config.name,
    label: config.label,
    description,
    promptSnippet: config.promptSnippet,
    promptGuidelines: [...(config.generalGuidelines ?? []), ...config.actions.flatMap((action) => action.promptGuidelines ?? [])],
    parameters,
    renderCall(args, theme) {
      const segments = [theme.bold(theme.fg("toolTitle", config.name)), theme.fg("accent", args.action)];
      const params = byName.get(args.action)?.renderParams?.(args, theme);
      if (params) segments.push(...params);

      return new Text(segments.join(" "), 0, 0);
    },
    renderResult(result, options, theme, context) {
      const details = result.details as ActionDetails | undefined;

      if (context.isError || !details) {
        const output = joinTextContent(result.content);
        return new Text(context.isError && output ? theme.fg("error", "\n" + output) : "", 0, 0);
      }

      const action = byName.get(details.action);
      if (action?.renderResult) return action.renderResult(result as AgentToolResult<ActionDetails>, options, theme, context);

      return new Text(joinTextContent(result.content), 0, 0);
    },
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const action = byName.get(params.action);
      if (!action) throw new Error(`Unknown ${config.name} action "${params.action}"`);

      for (const field of action.required ?? []) {
        if ((params as Record<string, unknown>)[field] === undefined) {
          throw new Error(`The "${params.action}" action requires "${field}"`);
        }
      }

      return action.execute(params as never, config.createContext(ctx), signal);
    },
  });
}
