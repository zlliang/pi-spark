import type { Api, Model } from "@earendil-works/pi-ai";

/** Check if a model has zero costs for all categories. */
export function isFreeModel(model: Model<Api>): boolean {
  return model.cost.input === 0 && model.cost.output === 0 && model.cost.cacheRead === 0 && model.cost.cacheWrite === 0;
}
