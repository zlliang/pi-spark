import { StringEnum } from "@earendil-works/pi-ai";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { formatDuration, joinTextContent } from "./format";

import type { AgentToolResult, ExtensionAPI, ExtensionContext, Theme, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import type { Static, TObject, TProperties, TSchema } from "typebox";

interface ActionDetails {
  action: string;
}

/**
 * One action of a composed tool. The registry merges all actions' `fields` into one flat schema
 * (provider-safe, unlike a discriminated union) and dispatches by `action`; `C` is the per-call
 * context from `createContext`.
 */
export interface Action<C, F extends TProperties = TProperties, D extends ActionDetails = ActionDetails> {
  name: D["action"];
  summary: string;
  fields: F;
  /** Fields required at runtime (the flat schema makes all fields optional). */
  required?: (keyof F & string)[];
  promptGuidelines?: string[];
  /** Show bash-style elapsed/took timing for this action. */
  showTiming?: boolean;
  /** Styled segments shown after the `<tool> <action>` prefix. */
  renderParams?: (args: Static<TObject<F>>, theme: Theme) => string[];
  renderResult?: NonNullable<ToolDefinition<TObject<F>, D>["renderResult"]>;
  execute(args: Static<TObject<F>>, context: C, signal: AbortSignal | undefined): Promise<AgentToolResult<D>>;
}

/** Identity helper bound to context `C`, so actions infer their field/details types while sharing one context shape. */
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

  const activeTiming = new ActiveTiming();
  const noTiming = new NoTiming();
  // Resolve per-action timing from the stable call args, so error results (no details) still settle.
  const timingFor = (action: string | undefined): Timing => (byName.get(action ?? "")?.showTiming ? activeTiming : noTiming);

  const renderActionResult: NonNullable<ToolDefinition["renderResult"]> = (result, options, theme, context) => {
    const details = result.details as ActionDetails | undefined;

    if (context.isError || !details) {
      const output = joinTextContent(result.content);
      return new Text(context.isError && output ? theme.fg("error", "\n" + output) : "", 0, 0);
    }

    const action = byName.get(details.action);
    if (action?.renderResult) return action.renderResult(result as AgentToolResult<ActionDetails>, options, theme, context as never);

    return new Text(joinTextContent(result.content), 0, 0);
  };

  pi.registerTool({
    name: config.name,
    label: config.label,
    description,
    promptSnippet: config.promptSnippet,
    promptGuidelines: [...(config.generalGuidelines ?? []), ...config.actions.flatMap((action) => action.promptGuidelines ?? [])],
    parameters,
    renderCall(args, theme, context) {
      const segments = [theme.bold(theme.fg("toolTitle", config.name)), theme.fg("accent", args.action)];
      const params = byName.get(args.action)?.renderParams?.(args, theme);
      if (params) segments.push(...params);

      return timingFor(context.args.action).renderCall(new Text(segments.join(" "), 0, 0), theme, context);
    },
    renderResult(result, options, theme, context) {
      const inner = renderActionResult(result, options, theme, context);

      return timingFor(context.args.action).renderResult(inner, options, theme, context);
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

/** A tuple type without its first element. */
type DropFirst<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : never;

/** A renderer's params after the leading args/result. */
type RenderCallTail = DropFirst<Parameters<NonNullable<ToolDefinition["renderCall"]>>>;
type RenderResultTail = DropFirst<Parameters<NonNullable<ToolDefinition["renderResult"]>>>;

/**
 * Bash-style timing for a tool row: a live "Elapsed" ticker while running, a final "Took" once
 * settled. `renderCall`/`renderResult` wrap the built component in place of the args/result.
 */
interface Timing {
  renderCall(inner: Component, ...rest: RenderCallTail): Component;
  renderResult(inner: Component, ...rest: RenderResultTail): Component;
}

/** Per-row timing state, kept in `ToolRenderContext.state` so the timing classes stay stateless. */
interface TimingState {
  startedAt?: number;
  endedAt?: number;
  interval?: ReturnType<typeof setInterval>;
}

class ActiveTiming implements Timing {
  renderCall(inner: Component, ...[theme, context]: RenderCallTail): Component {
    const state = context.state as TimingState;
    if (context.executionStarted && state.startedAt === undefined) {
      state.startedAt = Date.now();
      delete state.endedAt;
    }

    // Result is in: renderResult owns the timing line, so just settle here.
    if (!context.isPartial) {
      this.settle(state);
      return inner;
    }

    // Still running, no result yet: show a live "Elapsed" line, ticking once a second.
    if (state.startedAt === undefined) return inner;

    state.interval ??= setInterval(() => context.invalidate(), 1000);
    return this.withTimingLine(inner, "Elapsed", Date.now() - state.startedAt, theme);
  }

  renderResult(inner: Component, ...[options, theme, context]: RenderResultTail): Component {
    const state = context.state as TimingState;
    if (!options.isPartial || context.isError) this.settle(state);
    if (state.startedAt === undefined) return inner;

    const label = options.isPartial ? "Elapsed" : "Took";
    const endTime = state.endedAt ?? Date.now();
    return this.withTimingLine(inner, label, endTime - state.startedAt, theme);
  }

  private settle(state: TimingState): void {
    if (state.startedAt !== undefined) state.endedAt ??= Date.now();
    if (state.interval) {
      clearInterval(state.interval);
      delete state.interval;
    }
  }

  private withTimingLine(content: Component, label: string, ms: number, theme: Theme): Container {
    const container = new Container();
    container.addChild(content);

    container.addChild(new Spacer(1));
    container.addChild(new Text(`${theme.fg("muted", `${label} ${formatDuration(ms)}`)}`, 0, 0));

    return container;
  }
}

class NoTiming implements Timing {
  renderCall(inner: Component): Component {
    return inner;
  }
  renderResult(inner: Component): Component {
    return inner;
  }
}
