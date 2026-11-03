import assert from "node:assert/strict";
import test from "node:test";

import { creditsConfigSchema } from "../src/features/credits/config.ts";
import { selectCodexLanes } from "../src/features/credits/providers/openai-codex-display.ts";

const windows = Object.freeze([
  Object.freeze({ label: "5h", percent: 27, resetAt: 1792000000000 }),
  Object.freeze({ label: "7d", percent: 4, resetAt: 1792500000000 }),
]);
const spend = Object.freeze({
  percent: 100,
  suffix: "(0 cr., est. $0.00)",
  resetAt: 1794000000000,
});
const modes = ["both", "rate-limits", "spend"];

test("Codex defaults to both sources, including a zero-credit spend limit", () => {
  assert.deepEqual(selectCodexLanes(windows, spend), [...windows, spend]);
  assert.deepEqual(selectCodexLanes(windows, spend, undefined), [...windows, spend]);
});

test("both mode keeps usage windows before the upstream-style unlabeled spend limit", () => {
  const lanes = selectCodexLanes(windows, spend, "both");
  assert.deepEqual(lanes.map((lane) => lane.label), ["5h", "7d", undefined]);
  assert.equal(lanes[2].suffix, "(0 cr., est. $0.00)");
  assert.equal(lanes[2].resetAt, spend.resetAt);
});

test("rate-limits mode hides spend when windows exist", () => {
  assert.deepEqual(selectCodexLanes(windows, spend, "rate-limits"), windows);
});

test("spend mode hides windows when spend exists", () => {
  assert.deepEqual(selectCodexLanes(windows, spend, "spend"), [spend]);
});

for (const mode of modes) {
  test(`${mode}: windows are retained when spend is unavailable`, () => {
    assert.deepEqual(selectCodexLanes(windows, undefined, mode), windows);
  });

  test(`${mode}: spend is retained when windows are unavailable`, () => {
    assert.deepEqual(selectCodexLanes([], spend, mode), [spend]);
  });

  test(`${mode}: no source produces no fabricated values`, () => {
    assert.deepEqual(selectCodexLanes([], undefined, mode), []);
  });

  test(`${mode}: valid configuration is accepted`, () => {
    assert.equal(creditsConfigSchema.parse({ codexDisplay: mode }).codexDisplay, mode);
  });
}

test("a single returned rate-limit window does not trigger a spend fallback", () => {
  assert.deepEqual(selectCodexLanes([windows[1]], spend, "rate-limits"), [windows[1]]);
});

test("zero-percent sources count as available in both single-information modes", () => {
  const unusedWindow = { label: "5h", percent: 0 };
  const unusedSpend = { percent: 0, suffix: "(100 cr., est. $4.00)" };
  assert.deepEqual(selectCodexLanes([unusedWindow], spend, "rate-limits"), [unusedWindow]);
  assert.deepEqual(selectCodexLanes(windows, unusedSpend, "spend"), [unusedSpend]);
});

test("selection never mutates the provider's lane data", () => {
  const combined = selectCodexLanes(windows, spend, "both");
  combined.pop();
  assert.equal(windows.length, 2);
  assert.equal(spend.percent, 100);
  assert.equal(spend.suffix, "(0 cr., est. $0.00)");
});

test("existing credits configurations remain valid without a display option", () => {
  assert.deepEqual(creditsConfigSchema.parse({}), {});
  assert.deepEqual(
    creditsConfigSchema.parse({ providers: { "openai-codex": true, deepseek: false } }),
    { providers: { "openai-codex": true, deepseek: false } },
  );
});

for (const value of ["limits", "balance", "", null, false, 1, {}]) {
  test(`invalid Codex display value ${JSON.stringify(value)} is rejected`, () => {
    assert.equal(creditsConfigSchema.safeParse({ codexDisplay: value }).success, false);
  });
}
