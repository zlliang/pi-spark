import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";

import { featureSchemas } from "./schema";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SparkConfig } from "./schema";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

const cache = new Map<string, SparkConfig>();

/** Load and validate spark.json once per session lifecycle; later calls return the cached result. */
export function loadConfig(ctx: ExtensionContext, fileName: string = "spark.json"): SparkConfig {
  const key = `${ctx.cwd}\u0000${fileName}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const rawValue = loadMergedJson(getConfigPaths(ctx.cwd, fileName)) ?? {};
  const raw = isPlainObject(rawValue) ? rawValue : {};

  // Validate each feature independently so a single invalid field disables only that feature
  // (falling back to its enabled defaults) instead of taking down the whole config.
  const config = {} as Record<keyof SparkConfig, unknown>;
  const errors: string[] = [];

  for (const field of Object.keys(featureSchemas) as (keyof SparkConfig)[]) {
    const value = raw[field];

    if (value === undefined) {
      config[field] = {};
      continue;
    }

    if (value === false) {
      config[field] = false;
      continue;
    }

    const result = featureSchemas[field].safeParse(value);
    if (result.success) {
      config[field] = result.data;
      continue;
    }

    config[field] = {};
    const detail = result.error.issues.map((issue) => `${[field, ...issue.path].join(".")}: ${issue.message}`).join("; ");
    errors.push(detail);
  }

  if (errors.length > 0) {
    ctx.ui.notify(`Invalid spark config, using defaults for: ${errors.join("; ")}`, "error");
  }

  cache.set(key, config as SparkConfig);
  return config as SparkConfig;
}

function getConfigPaths(cwd: string, fileName: string): [globalPath: string, projectPath: string] {
  return [join(getAgentDir(), fileName), join(cwd, CONFIG_DIR_NAME, fileName)];
}

function loadMergedJson(paths: string[]): JsonObject | undefined {
  let merged: JsonObject | undefined;
  paths.forEach((path) => {
    const value = readJsonFile(path);
    if (value === undefined) return;

    merged = mergeConfig(merged, value);
  });

  return merged;
}

function readJsonFile(path: string): JsonObject | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
  } catch {
    return undefined;
  }
}

function mergeConfig(base: JsonObject | undefined, override: JsonObject): JsonObject {
  if (base === undefined) return override;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;

  const result: Record<string, JsonValue> = { ...base };
  Object.entries(override).forEach(([key, overrideValue]) => {
    const baseValue = base[key];
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = { ...baseValue, ...overrideValue };
    } else {
      result[key] = overrideValue;
    }
  });

  return result;
}

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
