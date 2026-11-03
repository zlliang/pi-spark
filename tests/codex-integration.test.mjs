import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test, { after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { CombinedAutocompleteProvider } from "@earendil-works/pi-tui";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cache = join(root, ".cache");
mkdirSync(cache, { recursive: true });
const agentDir = mkdtempSync(join(cache, "codex-integration-"));
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const originalFetch = globalThis.fetch;
process.env.PI_CODING_AGENT_DIR = agentDir;

after(() => {
  globalThis.fetch = originalFetch;
  if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
  rmSync(agentDir, { recursive: true, force: true });
});

// Use the declared Pi development host's own TypeScript loader, as Pi does.
const hostRequire = createRequire(import.meta.resolve("@earendil-works/pi-coding-agent"));
const { createJiti } = hostRequire("jiti");
const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false });
const usageWindows = {
  primary_window: { limit_window_seconds: 18000, used_percent: 27 },
  secondary_window: { limit_window_seconds: 604800, used_percent: 4 },
};
const spendControl = { individual_limit: { remaining: 0, used_percent: 100 } };
let payload;

globalThis.fetch = async (request) => {
  const url = typeof request === "string" ? request : request.url;
  assert.equal(url, "https://chatgpt.com/backend-api/wham/usage", "unexpected network request");
  return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
};

const { openaiCodexProvider } = await jiti.import("../src/features/credits/providers/openai-codex.ts");
const { renderCredits } = await jiti.import("../src/features/credits/status.ts");
const { CreditsManager } = await jiti.import("../src/features/credits/manager.ts");
const { registerCredits } = await jiti.import("../src/features/credits/index.ts");
const theme = { fg: (_color, text) => text };

beforeEach(() => {
  rmSync(join(agentDir, "spark.json"), { force: true });
  payload = {
    rate_limit: structuredClone(usageWindows),
    spend_control: structuredClone(spendControl),
    rate_limit_reset_credits: { available_count: 3 },
  };
});

async function fetchCredits(mode) {
  const config = mode ? { codexDisplay: mode } : {};
  return openaiCodexProvider.fetch("synthetic-test-value", new AbortController().signal, undefined, config);
}

for (const [mode, labels] of [
  [undefined, ["5h", "7d", undefined]],
  ["both", ["5h", "7d", undefined]],
  ["rate-limits", ["5h", "7d"]],
  ["spend", [undefined]],
]) {
  test(`provider: ${mode ?? "default"} selects the requested normalized sources`, async () => {
    const credits = await fetchCredits(mode);
    assert.deepEqual(credits.lanes.map((lane) => lane.label), labels);
    assert.equal(credits.suffix, "(3 resets available)");
    assert.match(renderCredits(theme, "Codex", credits), /3 resets available/);
  });
}

test("renderer preserves upstream formatting without an added spend label", async () => {
  assert.equal(
    renderCredits(theme, "Codex", await fetchCredits()),
    "Codex 5h 27% 7d 4% 100% (0 cr., est. $0.00) (3 resets available)",
  );
  assert.equal(
    renderCredits(theme, "Codex", await fetchCredits("spend")),
    "Codex 100% (0 cr., est. $0.00) (3 resets available)",
  );
});

test("provider falls back to windows when spend data is missing or invalid", async () => {
  for (const spend of [undefined, null, { individual_limit: null }, { individual_limit: { remaining: "unavailable" } }]) {
    payload.spend_control = spend;
    assert.deepEqual((await fetchCredits("spend")).lanes.map((lane) => lane.label), ["5h", "7d"]);
  }
});

test("provider falls back to spend when both windows are null or absent", async () => {
  for (const limits of [undefined, null, { primary_window: null, secondary_window: null }]) {
    payload.rate_limit = limits;
    assert.deepEqual((await fetchCredits("rate-limits")).lanes.map((lane) => lane.label), [undefined]);
  }
});

test("renderer keeps available information despite an unlimited credits flag", async () => {
  payload.credits = { unlimited: true };
  const credits = await fetchCredits();
  assert.equal(credits.unlimited, false);
  assert.match(renderCredits(theme, "Codex", credits), /5h 27% 7d 4% 100%/);
});

test("renderer retains remaining credits when the spend percentage is absent", async () => {
  payload.spend_control = { individual_limit: { remaining: 25 } };
  const credits = await fetchCredits("spend");
  assert.match(renderCredits(theme, "Codex", credits), /\?% \(25 cr\., est\. \$1\.00\)/);
});

test("no returned information is unknown, not a fabricated unlimited allowance", async () => {
  payload = {};
  assert.equal(renderCredits(theme, "Codex", await fetchCredits()), "Codex ?");
  payload = { credits: { unlimited: true } };
  assert.equal(renderCredits(theme, "Codex", await fetchCredits()), "Codex unlimited");
});

for (const mode of [undefined, "both", "rate-limits", "spend"]) {
  test(`session config: ${mode ?? "default"} reaches the rendered status`, async () => {
    const cwd = join(agentDir, `workspace-${mode ?? "default"}`);
    mkdirSync(join(cwd, ".pi"), { recursive: true });
    if (mode) writeFileSync(join(cwd, ".pi", "spark.json"), JSON.stringify({ credits: { codexDisplay: mode } }));

    const handlers = new Map();
    registerCredits({ on: (event, handler) => handlers.set(event, handler), registerCommand() {} });
    let ready;
    const status = new Promise((resolve) => { ready = resolve; });
    const ctx = {
      cwd,
      model: { provider: "openai-codex", cost: {} },
      modelRegistry: {
        find() {},
        async getProviderAuth() { return { auth: { apiKey: "synthetic-test-value" } }; },
      },
      ui: {
        theme,
        notify: (message) => assert.fail(message),
        setStatus: (_key, value) => { if (value) ready(value); },
      },
    };
    let timeout;
    try {
      handlers.get("session_start")({}, ctx);
      const text = await Promise.race([
        status,
        new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("status timeout")), 3000); }),
      ]);
      if (mode !== "spend") assert.match(text, /5h 27% 7d 4%/);
      else assert.doesNotMatch(text, /5h|7d/);
      if (mode !== "rate-limits") assert.match(text, /100% \(0 cr\., est\. \$0\.00\)/);
      else assert.doesNotMatch(text, /cr\., est\./);
      assert.doesNotMatch(text, /(?:spend|\$)\s+\d+%/);
    } finally {
      clearTimeout(timeout);
      handlers.get("session_shutdown")({}, ctx);
    }
  });
}

test("manager passes display configuration to the active provider", async () => {
  const config = { codexDisplay: "rate-limits" };
  let propagated;
  const definition = {
    id: "openai-codex", label: "Codex",
    async fetch(_value, _signal, _cost, options) {
      propagated = options;
      return { type: "windows", lanes: [] };
    },
  };
  const ctx = {
    model: { provider: "openai-codex", cost: {} },
    modelRegistry: {
      async getProviderAuth() { return { auth: { apiKey: "synthetic-test-value" } }; },
    },
    ui: { theme, setStatus() {} },
  };
  const manager = new CreditsManager([definition], config);
  await manager.refresh(ctx);
  assert.equal(propagated, config);
  manager.cancel();
});

function commandHarness(projectSettings) {
  const cwd = mkdtempSync(join(agentDir, "command-workspace-"));
  const projectPath = join(cwd, ".pi", "spark.json");
  if (projectSettings !== undefined) {
    mkdirSync(dirname(projectPath), { recursive: true });
    writeFileSync(projectPath, JSON.stringify(projectSettings));
  }
  const handlers = new Map();
  const commands = new Map();
  registerCredits({
    on: (event, handler) => handlers.set(event, handler),
    registerCommand: (name, command) => commands.set(name, command),
  });
  const notifications = [];
  const statuses = [];
  let nextStatus;
  const ctx = {
    cwd, hasUI: true, mode: "rpc",
    model: { provider: "openai-codex", cost: {} },
    modelRegistry: {
      find() {},
      async getProviderAuth() { return { auth: { apiKey: "synthetic-test-value" } }; },
    },
    ui: {
      theme,
      select: async () => undefined,
      notify: (message, type) => notifications.push({ message, type }),
      setStatus: (_key, value) => {
        if (value) {
          statuses.push(value);
          nextStatus?.(value);
          nextStatus = undefined;
        }
      },
    },
  };
  return {
    ctx, notifications, statuses, projectPath, commands,
    globalPath: join(agentDir, "spark.json"),
    command: commands.get("spark"),
    run: (argument = "") => commands.get("spark").handler(`codex-display${argument ? ` ${argument}` : ""}`, ctx),
    async start() {
      let timeout;
      try {
        const status = new Promise((resolve) => { nextStatus = resolve; });
        handlers.get("session_start")({}, ctx);
        await Promise.race([
          status,
          new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("initial status timeout")), 3000); }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
    },
    stop: () => handlers.get("session_shutdown")({}, ctx),
  };
}

function readSettings(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeSettings(path, settings) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(settings));
}

test("spark is registered without OAuth or a credits manager, replacing the standalone command", () => {
  const { command, commands } = commandHarness();
  assert.ok(command);
  assert.equal(commands.has("codex-display"), false);
  assert.deepEqual([...commands.keys()], ["spark"]);
  assert.deepEqual(command.getArgumentCompletions("").map((item) => item.value), ["codex-display"]);
  assert.deepEqual(command.getArgumentCompletions("cod").map((item) => item.value), ["codex-display"]);
  assert.deepEqual(command.getArgumentCompletions("codex-display ").map((item) => item.value), [
    "codex-display both", "codex-display rate-limits", "codex-display spend",
  ]);
  assert.deepEqual(command.getArgumentCompletions("codex-display rate").map((item) => item.value), ["codex-display rate-limits"]);
  assert.deepEqual(command.getArgumentCompletions("  codex-display\tsp").map((item) => item.value), ["codex-display spend"]);
  for (const prefix of ["invalid", "codex-display-more ", "codex-display invalid", "codex-display spend extra"]) {
    assert.equal(command.getArgumentCompletions(prefix), null);
  }
});

test("TUI argument completion preserves the spark namespace and the subcommand", async () => {
  const harness = commandHarness();
  const provider = new CombinedAutocompleteProvider([
    { name: "spark", getArgumentCompletions: harness.command.getArgumentCompletions },
  ], harness.ctx.cwd);
  const line = "/spark codex-display rate";
  const suggestions = await provider.getSuggestions([line], 0, line.length, { signal: new AbortController().signal });
  assert.ok(suggestions);
  const completed = provider.applyCompletion([line], 0, line.length, suggestions.items[0], suggestions.prefix);
  assert.deepEqual(completed.lines, ["/spark codex-display rate-limits"]);
});

test("bare spark shows usage without opening the selector or changing settings", async () => {
  const harness = commandHarness();
  harness.ctx.ui.select = async () => assert.fail("unexpected selector");
  await harness.command.handler("", harness.ctx);
  assert.equal(harness.notifications.at(-1).type, "info");
  assert.match(harness.notifications.at(-1).message, /Usage: \/spark codex-display/);
  assert.equal(existsSync(harness.globalPath), false);
  assert.deepEqual(harness.statuses, []);
});

test("spark rejects unknown subcommands and unprefixed modes without changing settings", async () => {
  const harness = commandHarness();
  harness.ctx.ui.select = async () => assert.fail("unexpected selector");
  for (const argument of ["unknown", "spend", "codex-display-more spend", "codex-displayx"]) {
    await harness.command.handler(argument, harness.ctx);
    assert.equal(harness.notifications.at(-1).type, "error");
    assert.match(harness.notifications.at(-1).message, /Usage: \/spark codex-display/);
    assert.equal(existsSync(harness.globalPath), false);
  }
});

test("spark accepts whitespace-separated subcommand arguments", async () => {
  const harness = commandHarness();
  await harness.command.handler("  codex-display\t  spend\n", harness.ctx);
  assert.equal(readSettings(harness.globalPath).credits.codexDisplay, "spend");
});

for (const mode of ["both", "rate-limits", "spend"]) {
  test(`command persists ${mode} globally without creating a project override`, async () => {
    const harness = commandHarness();
    await harness.run(mode);
    assert.equal(readSettings(harness.globalPath).credits.codexDisplay, mode);
    assert.equal(existsSync(harness.projectPath), false);
    assert.equal(harness.notifications.at(-1).type, "info");
    if (process.platform !== "win32") assert.equal(statSync(harness.globalPath).mode & 0o777, 0o600);
  });
}

test("command applies every mode immediately to an already running status, without reload", async () => {
  const harness = commandHarness();
  try {
    await harness.start();
    assert.match(harness.statuses.at(-1), /5h 27% 7d 4% 100%/);
    for (const mode of ["rate-limits", "spend", "both"]) {
      await harness.run(mode);
      const text = harness.statuses.at(-1);
      if (mode !== "spend") assert.match(text, /5h 27% 7d 4%/);
      else assert.doesNotMatch(text, /5h|7d/);
      if (mode !== "rate-limits") assert.match(text, /100% \(0 cr\./);
      else assert.doesNotMatch(text, /cr\., est\./);
      assert.equal(readSettings(harness.globalPath).credits.codexDisplay, mode);
    }
  } finally {
    harness.stop();
  }
});

test("command keeps fallback behavior when the preferred source is absent", async () => {
  const harness = commandHarness();
  try {
    await harness.start();
    payload = { rate_limit: usageWindows };
    await harness.run("spend");
    assert.match(harness.statuses.at(-1), /5h 27% 7d 4%/);
    payload = { spend_control: spendControl };
    await harness.run("rate-limits");
    assert.match(harness.statuses.at(-1), /100% \(0 cr\./);
  } finally {
    harness.stop();
  }
});

for (const mode of ["rpc", "tui"]) {
  test(`codex-display without a mode opens a supported ${mode} selector and saves the choice`, async () => {
    const harness = commandHarness();
    harness.ctx.mode = mode;
    let title;
    harness.ctx.ui.select = async (heading, options) => {
      title = heading;
      assert.equal(options.length, 3);
      return options.find((option) => option.startsWith("rate-limits"));
    };
    await harness.run();
    assert.match(title, /current: both/);
    assert.equal(readSettings(harness.globalPath).credits.codexDisplay, "rate-limits");
  });
}

test("canceling the selector changes neither settings nor status", async () => {
  const harness = commandHarness();
  await harness.run();
  assert.equal(existsSync(harness.globalPath), false);
  assert.equal(existsSync(harness.projectPath), false);
  assert.deepEqual(harness.statuses, []);
  assert.deepEqual(harness.notifications, []);
});

test("command rejects invalid arguments without saving or opening a selector", async () => {
  const harness = commandHarness();
  harness.ctx.ui.select = async () => assert.fail("unexpected selector");
  for (const argument of ["unknown", "BOTH", "rate-limits extra"]) {
    await harness.run(argument);
    assert.equal(harness.notifications.at(-1).type, "error");
    assert.match(harness.notifications.at(-1).message, /Usage:/);
    assert.equal(existsSync(harness.globalPath), false);
  }
});

test("command preserves all unrelated global preferences and unknown fields", async () => {
  const harness = commandHarness();
  const original = {
    editor: false, footer: { statusPosition: "below" },
    credits: { codexDisplay: "both", providers: { deepseek: false }, customPreference: { keep: true } },
    anotherPreference: ["retained"],
  };
  writeSettings(harness.globalPath, original);
  await harness.run("spend");
  assert.deepEqual(readSettings(harness.globalPath), {
    ...original, credits: { ...original.credits, codexDisplay: "spend" },
  });
});

test("command updates an existing project override without touching global preferences", async () => {
  const project = { editor: false, credits: { codexDisplay: "rate-limits", providers: { deepseek: false } } };
  const harness = commandHarness(project);
  writeSettings(harness.globalPath, { credits: { codexDisplay: "both" }, title: false });
  const originalGlobal = readFileSync(harness.globalPath, "utf8");
  await harness.run("spend");
  assert.equal(readFileSync(harness.globalPath, "utf8"), originalGlobal);
  assert.deepEqual(readSettings(harness.projectPath), {
    ...project, credits: { ...project.credits, codexDisplay: "spend" },
  });
  assert.match(harness.notifications.at(-1).message, /this workspace/);
});

test("a project file without a display override does not prevent global saving", async () => {
  const harness = commandHarness({ credits: { providers: { deepseek: false } }, footer: false });
  const originalProject = readFileSync(harness.projectPath, "utf8");
  await harness.run("spend");
  assert.equal(readSettings(harness.globalPath).credits.codexDisplay, "spend");
  assert.equal(readFileSync(harness.projectPath, "utf8"), originalProject);
});

test("command never globally enables credits that were enabled only in a workspace", async () => {
  const harness = commandHarness({ credits: {} });
  writeSettings(harness.globalPath, { credits: false });
  const originalGlobal = readFileSync(harness.globalPath, "utf8");
  await harness.run("spend");
  assert.equal(readFileSync(harness.globalPath, "utf8"), originalGlobal);
  assert.equal(readSettings(harness.projectPath).credits.codexDisplay, "spend");
});

test("command preserves malformed global JSON without leaking parser fragments", async () => {
  const harness = commandHarness();
  const invalid = '{"unrelatedSetting":"fragment-that-must-not-be-displayed",';
  writeFileSync(harness.globalPath, invalid);
  await harness.run("spend");
  assert.equal(readFileSync(harness.globalPath, "utf8"), invalid);
  assert.equal(harness.notifications.at(-1).type, "error");
  assert.doesNotMatch(harness.notifications.at(-1).message, /fragment-that-must-not-be-displayed/);
});

test("command refuses malformed project JSON instead of overwriting either configuration", async () => {
  const harness = commandHarness();
  const invalid = "{ invalid JSON";
  mkdirSync(dirname(harness.projectPath), { recursive: true });
  writeFileSync(harness.projectPath, invalid);
  writeSettings(harness.globalPath, { credits: { codexDisplay: "both" } });
  const originalGlobal = readFileSync(harness.globalPath, "utf8");
  await harness.run("spend");
  assert.equal(readFileSync(harness.projectPath, "utf8"), invalid);
  assert.equal(readFileSync(harness.globalPath, "utf8"), originalGlobal);
  assert.equal(harness.notifications.at(-1).type, "error");
});

test("command refuses invalid root or credits shapes without repairing unrelated settings", async () => {
  for (const original of [null, [], { credits: [] }, { credits: { providers: "invalid" } }]) {
    const harness = commandHarness();
    writeSettings(harness.globalPath, original);
    const text = readFileSync(harness.globalPath, "utf8");
    await harness.run("spend");
    assert.equal(readFileSync(harness.globalPath, "utf8"), text);
    assert.equal(harness.notifications.at(-1).type, "error");
  }
});

test("command respects explicitly disabled credits", async () => {
  const harness = commandHarness({ credits: false });
  const originalProject = readFileSync(harness.projectPath, "utf8");
  await harness.run("spend");
  assert.equal(readFileSync(harness.projectPath, "utf8"), originalProject);
  assert.equal(existsSync(harness.globalPath), false);
  assert.equal(harness.notifications.at(-1).type, "warning");
});

test("non-UI calls require an explicit argument, but direct modes still work", async () => {
  const harness = commandHarness();
  harness.ctx.hasUI = false;
  harness.ctx.ui.select = async () => assert.fail("non-UI selector");
  await harness.run();
  assert.equal(existsSync(harness.globalPath), false);
  await harness.run("spend");
  assert.equal(readSettings(harness.globalPath).credits.codexDisplay, "spend");
});

test("saved mode survives a new context and is shown as the selector's current choice", async () => {
  const first = commandHarness();
  await first.run("spend");
  const second = commandHarness();
  let title;
  second.ctx.ui.select = async (value) => { title = value; };
  await second.run();
  assert.match(title, /current: spend/);
});

test("a persistence failure leaves the running display unchanged", async () => {
  const harness = commandHarness();
  try {
    await harness.start();
    const originalStatus = harness.statuses.at(-1);
    mkdirSync(harness.globalPath);
    await harness.run("spend");
    assert.equal(harness.notifications.at(-1).type, "error");
    assert.equal(harness.statuses.at(-1), originalStatus);
    assert.equal(statSync(harness.globalPath).isDirectory(), true);
  } finally {
    rmSync(harness.globalPath, { recursive: true, force: true });
    harness.stop();
  }
});

test("command preserves a symlinked global configuration", { skip: process.platform === "win32" }, async () => {
  const harness = commandHarness();
  const target = join(harness.ctx.cwd, "linked-spark.json");
  writeSettings(target, { footer: false, credits: { codexDisplay: "both" } });
  symlinkSync(target, harness.globalPath);
  await harness.run("spend");
  assert.equal(lstatSync(harness.globalPath).isSymbolicLink(), true);
  assert.deepEqual(readSettings(target), { footer: false, credits: { codexDisplay: "spend" } });
});
