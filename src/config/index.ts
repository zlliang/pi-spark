import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { defu } from "defu";

import { featureSchemas } from "./schema";
import { creditsConfigSchema } from "../features/credits/config";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SparkConfig } from "./schema";
import type { CodexDisplay } from "../features/credits/config";

const CONFIG_FILE = "spark.json";

const cache = new Map<string, SparkConfig>();

/** Loads and validates spark.json once per session lifecycle; later calls return the cached result. */
export function loadConfig(ctx: ExtensionContext): SparkConfig {
  const cached = cache.get(ctx.cwd);
  if (cached) return cached;

  // Deep-merge the global file under the project file, so project settings win at scalar
  // leaves while deep objects (e.g., `recap.model`) combine across both.
  const [globalPath, projectPath] = getConfigPaths(ctx.cwd, CONFIG_FILE);
  const raw = defu(readJson(projectPath) ?? {}, readJson(globalPath) ?? {});

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

  cache.set(ctx.cwd, config as SparkConfig);
  return config as SparkConfig;
}

export class SparkConfigUpdateError extends Error {}

/** Persists only the display preference in its effective scope, preserving unrelated settings. */
export function saveCodexDisplay(ctx: ExtensionContext, display: CodexDisplay): "global" | "project" {
  if (!creditsConfigSchema.safeParse({ codexDisplay: display }).success) {
    throw new SparkConfigUpdateError("Invalid Codex display mode.");
  }

  const config = loadConfig(ctx);
  if (!config.credits) throw new SparkConfigUpdateError("Credits are disabled in spark.json.");

  const [globalPath, projectPath] = getConfigPaths(ctx.cwd, CONFIG_FILE);
  const project = readJsonForUpdate(projectPath);
  const projectCredits = project?.credits;
  const projectOverride = isRecord(projectCredits) && Object.hasOwn(projectCredits, "codexDisplay");
  const global = projectOverride ? undefined : readJsonForUpdate(globalPath);
  // Do not enable credits globally when they were enabled only by this workspace.
  const projectEnabledCredits = isRecord(projectCredits) && global?.credits !== undefined && !isRecord(global.credits);
  const scope = projectOverride || projectEnabledCredits ? "project" : "global";
  const path = scope === "project" ? projectPath : globalPath;
  const existing = (scope === "project" ? project : global) ?? {};

  if (existing.credits !== undefined && !isRecord(existing.credits)) {
    throw new SparkConfigUpdateError("Cannot update invalid or disabled credits settings in spark.json.");
  }
  const credits = { ...(isRecord(existing.credits) ? existing.credits : {}), codexDisplay: display };
  if (!creditsConfigSchema.safeParse(credits).success) {
    throw new SparkConfigUpdateError("Fix invalid credits settings in spark.json before changing Codex display.");
  }

  writeJsonAtomically(path, { ...existing, credits });
  if (scope === "global") cache.clear();
  else cache.delete(ctx.cwd);
  config.credits.codexDisplay = display;
  cache.set(ctx.cwd, config);
  return scope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJsonForUpdate(path: string): Record<string, unknown> | undefined {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new SparkConfigUpdateError("Cannot read spark.json; no settings were overwritten.");
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) return parsed;
  } catch {
    // Never include parser errors: they can contain private configuration fragments.
  }
  throw new SparkConfigUpdateError("spark.json must contain a valid JSON object; no settings were overwritten.");
}

function writeJsonAtomically(path: string, settings: Record<string, unknown>): void {
  const target = existsSync(path) ? realpathSync(path) : path;
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  const mode = existsSync(target) ? statSync(target).mode & 0o777 : 0o600;
  try {
    writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", mode, flag: "wx" });
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function getConfigPaths(cwd: string, fileName: string): [globalPath: string, projectPath: string] {
  return [join(getAgentDir(), fileName), join(cwd, CONFIG_DIR_NAME, fileName)];
}

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
