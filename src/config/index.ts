import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { defu } from "defu";

import { featureSchemas } from "./schema";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SparkConfig } from "./schema";

const cache = new Map<string, SparkConfig>();

/** Load and validate spark.json once per session lifecycle; later calls return the cached result. */
export function loadConfig(ctx: ExtensionContext, fileName: string = "spark.json"): SparkConfig {
  const key = `${ctx.cwd}\u0000${fileName}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Deep-merge the global file under the project file, so project settings win at scalar
  // leaves while deep objects (e.g., `recap.model`) combine across both.
  const [globalPath, projectPath] = getConfigPaths(ctx.cwd, fileName);
  const raw = defu(readRawConfig(projectPath) ?? {}, readRawConfig(globalPath) ?? {});

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
    errors.push(result.error.issues.map((issue) => `${[field, ...issue.path].join(".")}: ${issue.message}`).join("; "));
  }

  if (errors.length > 0) {
    ctx.ui.notify(`Invalid pi-spark config: ${errors.join("; ")}`, "error");
  }

  cache.set(key, config as SparkConfig);
  return config as SparkConfig;
}

function getConfigPaths(cwd: string, fileName: string): [globalPath: string, projectPath: string] {
  return [join(getAgentDir(), fileName), join(cwd, CONFIG_DIR_NAME, fileName)];
}

function readRawConfig(path: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
