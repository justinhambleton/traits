import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileProfile, compileResolvedProfile } from "../dist/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");
const KNOWLEDGE_BASE_DIR = path.join(ROOT, "knowledge-base");

function profileFile(name) {
  return path.join(PROFILES_DIR, name);
}

function makeProfile(voiceOverrides = {}) {
  return {
    schema: "v1.6",
    meta: { name: "adaptive-test", version: "1.0.0", description: "test" },
    identity: { role: "assistant" },
    voice: {
      formality: "medium",
      warmth: "medium",
      verbosity: "medium",
      directness: "medium",
      empathy: "medium",
      humor: "very-low",
      ...voiceOverrides
    }
  };
}

// 1. Profile with adapt: true renders [ADAPTIVE RANGES] section
test("adaptive compilation: profile with adapt renders ADAPTIVE RANGES section", () => {
  const profile = makeProfile({
    warmth: { target: "high", adapt: true, floor: "high", ceiling: "very-high" },
    formality: { target: "medium", adapt: true, floor: "low", ceiling: "high" }
  });

  const compiled = compileResolvedProfile(profile, { model: "claude-sonnet" });

  assert.ok(compiled.text.includes("[ADAPTIVE RANGES]"));
  assert.ok(compiled.text.includes("You may adjust the following dimensions within the specified bounds"));
  assert.ok(compiled.text.includes("warmth: Shift between high and very-high"));
  assert.ok(compiled.text.includes("formality: Shift between low and high"));
  assert.ok(compiled.text.includes("Dimensions not listed above are locked at their target values"));
});

// 2. Profile with all locked dimensions — no [ADAPTIVE RANGES] section
test("adaptive compilation: all locked dimensions produce no ADAPTIVE RANGES section", () => {
  const profile = makeProfile({
    formality: "medium",
    warmth: "high",
    verbosity: "medium",
    directness: "high",
    empathy: "high",
    humor: "very-low"
  });

  const compiled = compileResolvedProfile(profile, { model: "claude-sonnet" });

  assert.ok(!compiled.text.includes("[ADAPTIVE RANGES]"));
  assert.ok(!compiled.text.includes("Shift between"));
});

// 3. Mixed locked/adaptive dimensions — only adaptive listed in ranges
test("adaptive compilation: mixed dimensions only lists adaptive ones in ranges", () => {
  const profile = makeProfile({
    formality: "medium",
    warmth: { target: "high", adapt: true, floor: "high", ceiling: "very-high" },
    verbosity: "medium",
    directness: "high",
    empathy: { target: "high", adapt: true, floor: "medium", ceiling: "very-high" },
    humor: "very-low"
  });

  const compiled = compileResolvedProfile(profile, { model: "claude-sonnet" });

  assert.ok(compiled.text.includes("[ADAPTIVE RANGES]"));
  assert.ok(compiled.text.includes("warmth: Shift between high and very-high"));
  assert.ok(compiled.text.includes("empathy: Shift between medium and very-high"));
  // Locked dimensions should NOT appear in adaptive ranges
  assert.ok(!compiled.text.includes("formality: Shift between"));
  assert.ok(!compiled.text.includes("directness: Shift between"));
  assert.ok(!compiled.text.includes("humor: Shift between"));
});

// 4. floor equals target — still renders (upward flex only)
test("adaptive compilation: floor equals target still renders range (upward flex)", () => {
  const profile = makeProfile({
    warmth: { target: "high", adapt: true, floor: "high", ceiling: "very-high" }
  });

  const compiled = compileResolvedProfile(profile, { model: "claude-sonnet" });

  assert.ok(compiled.text.includes("[ADAPTIVE RANGES]"));
  assert.ok(compiled.text.includes("warmth: Shift between high and very-high"));
});

// 5. ceiling equals target — still renders (downward flex only)
test("adaptive compilation: ceiling equals target still renders range (downward flex)", () => {
  const profile = makeProfile({
    formality: { target: "high", adapt: true, floor: "low", ceiling: "high" }
  });

  const compiled = compileResolvedProfile(profile, { model: "claude-sonnet" });

  assert.ok(compiled.text.includes("[ADAPTIVE RANGES]"));
  assert.ok(compiled.text.includes("formality: Shift between low and high"));
});

// 6. Context adaptation overriding adaptive dimension to locked — excludes from ranges
test("adaptive compilation: context override to locked excludes dimension from ranges", () => {
  const profile = makeProfile({
    warmth: { target: "high", adapt: true, floor: "high", ceiling: "very-high" },
    formality: { target: "medium", adapt: true, floor: "low", ceiling: "high" }
  });
  profile.context_adaptations = [
    {
      when: "test_context",
      adjustments: {
        formality: { target: "low", adapt: false }
      },
      inject: ["Test injection"]
    }
  ];

  const compiled = compileResolvedProfile(profile, {
    model: "claude-sonnet",
    context: { test_context: true }
  });

  assert.ok(compiled.text.includes("[ADAPTIVE RANGES]"));
  // warmth is still adaptive
  assert.ok(compiled.text.includes("warmth: Shift between high and very-high"));
  // formality was overridden to locked via context adaptation
  assert.ok(!compiled.text.includes("formality: Shift between"));
});

// 7. Inline annotation appears in [VOICE TARGETS] line
test("adaptive compilation: inline annotation appears in VOICE TARGETS line", () => {
  const profile = makeProfile({
    warmth: { target: "high", adapt: true, floor: "high", ceiling: "very-high" },
    formality: "medium"
  });

  const compiled = compileResolvedProfile(profile, { model: "claude-sonnet" });

  // Adaptive dimension should have inline annotation
  assert.ok(compiled.text.includes("warmth: high (adaptive: high \u2192 very-high)"));
  // Locked dimension should NOT have annotation
  assert.ok(compiled.text.includes("formality: medium"));
  assert.ok(!compiled.text.includes("formality: medium (adaptive:"));
});

// 8. Token count increases with adaptive ranges
test("adaptive compilation: token count increases with adaptive ranges", () => {
  const lockedProfile = makeProfile({
    formality: "medium",
    warmth: "high"
  });
  const adaptiveProfile = makeProfile({
    formality: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    warmth: { target: "high", adapt: true, floor: "high", ceiling: "very-high" }
  });

  const lockedCompiled = compileResolvedProfile(lockedProfile, { model: "claude-sonnet" });
  const adaptiveCompiled = compileResolvedProfile(adaptiveProfile, { model: "claude-sonnet" });

  assert.ok(
    adaptiveCompiled.metadata.token_count > lockedCompiled.metadata.token_count,
    `adaptive (${adaptiveCompiled.metadata.token_count}) should exceed locked (${lockedCompiled.metadata.token_count})`
  );
});

// 9. Real profile (resolve.yaml) renders adaptive ranges correctly
test("adaptive compilation: resolve.yaml renders adaptive ranges in compiled output", () => {
  const compiled = compileProfile(profileFile("resolve.yaml"), {
    model: "claude-sonnet",
    bundledProfilesDir: PROFILES_DIR,
    knowledgeBaseDir: KNOWLEDGE_BASE_DIR
  });

  assert.ok(compiled.text.includes("[ADAPTIVE RANGES]"));
  assert.ok(compiled.text.includes("formality: Shift between low and high"));
  assert.ok(compiled.text.includes("warmth: Shift between high and very-high"));
  assert.ok(compiled.text.includes("verbosity: Shift between low and high"));
  assert.ok(compiled.text.includes("empathy: Shift between high and very-high"));
  // directness and humor are locked in resolve.yaml
  assert.ok(!compiled.text.includes("directness: Shift between"));
  assert.ok(!compiled.text.includes("humor: Shift between"));
  // Inline annotations in VOICE TARGETS
  assert.ok(compiled.text.includes("formality: medium (adaptive: low \u2192 high)"));
});

// 10. adaptive_dimensions metadata tracks which dimensions are adaptive
test("adaptive compilation: metadata.adaptive_dimensions lists adaptive dimensions", () => {
  const profile = makeProfile({
    warmth: { target: "high", adapt: true, floor: "high", ceiling: "very-high" },
    formality: "medium",
    empathy: { target: "high", adapt: true, floor: "medium", ceiling: "very-high" }
  });

  const compiled = compileResolvedProfile(profile, { model: "claude-sonnet" });

  assert.ok(Array.isArray(compiled.metadata.adaptive_dimensions));
  assert.ok(compiled.metadata.adaptive_dimensions.includes("warmth"));
  assert.ok(compiled.metadata.adaptive_dimensions.includes("empathy"));
  assert.ok(!compiled.metadata.adaptive_dimensions.includes("formality"));
});
