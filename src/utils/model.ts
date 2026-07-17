import { uuidv7 } from "@earendil-works/pi-agent-core";
import { clampThinkingLevel, cleanupSessionResources } from "@earendil-works/pi-ai";
import { completeSimple } from "@earendil-works/pi-ai/compat";

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

/**
 * Complete a one-shot background request, using an isolated session for OpenAI Codex models.
 * See [the investigation](../../docs/background-model-calls-and-openai-codex-sessions.md).
 */
export const completeBackground: typeof completeSimple = async (model, context, options) => {
  if (model.api !== "openai-codex-responses") return completeSimple(model, context, options);

  const sessionId = uuidv7();

  try {
    return await completeSimple(model, context, { ...options, sessionId });
  } finally {
    cleanupSessionResources(sessionId);
  }
};

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
