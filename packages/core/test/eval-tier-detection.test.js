import test from "node:test";
import assert from "node:assert/strict";

import { detectEvalTierAvailability, resolveTierExecution } from "../dist/internal.js";

test("detectEvalTierAvailability reports key-gated Tier 2 and Tier 3", () => {
  const availability = detectEvalTierAvailability({});
  assert.equal(availability[1].available, true);
  assert.equal(availability[1].implemented, true);
  assert.equal(availability[2].available, false);
  assert.equal(availability[2].implemented, true);
  assert.equal(availability[3].available, false);
  assert.equal(availability[3].implemented, true);
});

test("resolveTierExecution falls back to tier 1 when higher tiers are unavailable", () => {
  const availability = detectEvalTierAvailability({});
  const resolution = resolveTierExecution(3, availability);
  assert.equal(resolution.tier_executed, 1);
  assert.deepEqual(resolution.tiers_run, [1]);
  assert.equal(resolution.blocked.length, 2);
  assert.equal(resolution.blocked[0].tier, 2);
  assert.equal(resolution.blocked[1].tier, 3);
});

test("resolveTierExecution executes through tier 3 when keys are available", () => {
  const availability = detectEvalTierAvailability({
    TRAITS_OPENAI_API_KEY: "test-key",
    TRAITS_ANTHROPIC_API_KEY: "test-key"
  });
  const resolution = resolveTierExecution(3, availability);
  assert.equal(availability[2].available, true);
  assert.equal(availability[3].available, true);
  assert.equal(resolution.tier_executed, 3);
  assert.deepEqual(resolution.tiers_run, [1, 2, 3]);
  assert.equal(resolution.blocked.length, 0);
});

test("detectEvalTierAvailability honors OpenAI provider preference", () => {
  const availability = detectEvalTierAvailability(
    { TRAITS_ANTHROPIC_API_KEY: "anthropic-only" },
    { provider: "openai" }
  );
  assert.equal(availability[3].available, false);
  assert.match(availability[3].reason, /OpenAI/);
});

test("detectEvalTierAvailability honors Anthropic provider preference", () => {
  const availability = detectEvalTierAvailability(
    { TRAITS_OPENAI_API_KEY: "openai-only" },
    { provider: "anthropic" }
  );
  assert.equal(availability[3].available, false);
  assert.match(availability[3].reason, /Anthropic/);
});
