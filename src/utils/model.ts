import { clampThinkingLevel } from "@earendil-works/pi-ai";

import { formatModel } from "./format";

import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OptionalModelConfig } from "../config/model";

const DEFAULT_THINKING_LEVEL: ModelThinkingLevel = "off";

export type ModelSettings = {
  model: Model<Api>;
  thinkingLevel: ModelThinkingLevel;
  warning: string | undefined;
};

type ModelSelection = {
  model: Model<Api>;
  warning: string | undefined;
};

type ThinkingLevelSelection = {
  thinkingLevel: ModelThinkingLevel;
  warning: string | undefined;
};

/** Check if a model has zero costs for all categories. */
export function isFreeModel(model: Model<Api>): boolean {
  return model.cost.input === 0 && model.cost.output === 0 && model.cost.cacheRead === 0 && model.cost.cacheWrite === 0;
}

/**
 * Resolve the model and thinking level for a background feature (recap, title, ...).
 *
 * `feature` names the config section so warnings can point at the offending fields. When the
 * feature's model config is incomplete or unavailable, this falls back to the session's main
 * model and reports why via `warning`. Pass `notifyOnMissingModel: false` for silent features.
 *
 * The thinking level defaults to "off" (clamped to the model) when not set in config, so these
 * background features stay cheap regardless of the working model's thinking level.
 */
export async function resolveModelSettings(ctx: ExtensionContext, config: OptionalModelConfig, feature: string, options: { notifyOnMissingModel?: boolean } = {}): Promise<ModelSettings | undefined> {
  const fallbackModel = ctx.model;
  if (!fallbackModel) {
    if (options.notifyOnMissingModel ?? true) ctx.ui.notify(`No model selected for ${feature}`, "warning");
    return;
  }

  const { model, warning: modelWarning } = await resolveModelSelection(ctx, config, feature, fallbackModel);
  const { thinkingLevel, warning: thinkingLevelWarning } = resolveThinkingLevel(model, config.thinkingLevel ?? DEFAULT_THINKING_LEVEL);

  return {
    model,
    thinkingLevel,
    warning: [modelWarning, thinkingLevelWarning].filter(Boolean).join(" ") || undefined,
  };
}

async function resolveModelSelection(ctx: ExtensionContext, config: OptionalModelConfig, feature: string, fallbackModel: Model<Api>): Promise<ModelSelection> {
  if (!config.provider && !config.model) {
    return {
      model: fallbackModel,
      warning: undefined,
    };
  }

  if (!config.provider || !config.model) {
    return {
      model: fallbackModel,
      warning: `Both ${feature}.provider and ${feature}.model are required; using the current model.`,
    };
  }

  const model = ctx.modelRegistry.find(config.provider, config.model);
  if (!model) {
    return {
      model: fallbackModel,
      warning: `Model ${formatModel(config.provider, config.model)} not found; using the current model.`,
    };
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) {
    return {
      model: fallbackModel,
      warning: `Model ${formatModel(config.provider, config.model)} unavailable: ${auth.error}; using the current model.`,
    };
  }

  return {
    model,
    warning: undefined,
  };
}

function resolveThinkingLevel(model: Model<Api>, requested: ModelThinkingLevel): ThinkingLevelSelection {
  const thinkingLevel = clampThinkingLevel(model, requested);
  if (thinkingLevel === requested) {
    return {
      thinkingLevel,
      warning: undefined,
    };
  }

  const fallback = clampThinkingLevel(model, DEFAULT_THINKING_LEVEL);
  return {
    thinkingLevel: fallback,
    warning: `Thinking level ${requested} is not supported by ${formatModel(model.provider, model.id)}; using ${fallback}.`,
  };
}
