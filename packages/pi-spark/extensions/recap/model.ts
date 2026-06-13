import { clampThinkingLevel } from "@earendil-works/pi-ai";

import { formatModel } from "../shared/format";

import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { OptionalModelConfig } from "../shared/config/model";

const DEFAULT_THINKING_LEVEL: ModelThinkingLevel = "off";

type RecapModelSettings = {
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

export async function resolveRecapModelSettings(pi: ExtensionAPI, ctx: ExtensionContext, config: OptionalModelConfig): Promise<RecapModelSettings | undefined> {
  const fallbackModel = ctx.model;
  if (!fallbackModel) {
    ctx.ui.notify("No model selected for recap", "warning");
    return;
  }

  const { model, warning: modelWarning } = await resolveModelSelection(ctx, config, fallbackModel);
  const { thinkingLevel, warning: thinkingLevelWarning } = resolveThinkingLevel(model, config.thinkingLevel ?? pi.getThinkingLevel());

  return {
    model,
    thinkingLevel,
    warning: [modelWarning, thinkingLevelWarning].filter(Boolean).join(" ") || undefined,
  };
}

async function resolveModelSelection(ctx: ExtensionContext, config: OptionalModelConfig, fallbackModel: Model<Api>): Promise<ModelSelection> {
  if (!config.provider && !config.model) {
    return {
      model: fallbackModel,
      warning: undefined,
    };
  }

  if (!config.provider || !config.model) {
    return {
      model: fallbackModel,
      warning: "Both recap.provider and recap.model are required; using the current model.",
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
