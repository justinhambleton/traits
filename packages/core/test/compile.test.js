import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileProfile } from "../src/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");
const KNOWLEDGE_BASE_DIR = path.join(ROOT, "knowledge-base");

function profileFile(name) {
  return path.join(PROFILES_DIR, name);
}

test("compileProfile: claude placement and safety floor are included", () => {
  const compiled = compileProfile(profileFile("resolve.yaml"), {
    model: "claude-sonnet",
    bundledProfilesDir: PROFILES_DIR
  });

  assert.equal(compiled.placement.recommended_position, "start");
  assert.ok(compiled.text.includes("<safety_floor>"));
  assert.equal(compiled.metadata.safety_floor_included, true);
});

test("compileProfile: gpt placement uses after_tools", () => {
  const compiled = compileProfile(profileFile("resolve.yaml"), {
    model: "gpt-4o",
    bundledProfilesDir: PROFILES_DIR
  });

  assert.equal(compiled.placement.recommended_position, "after_tools");
  assert.ok(compiled.text.includes("[SAFETY FLOOR]"));
});

test("compileProfile: context adaptations affect compiled voice and trace", () => {
  const compiled = compileProfile(profileFile("haven.yaml"), {
    model: "claude-sonnet",
    bundledProfilesDir: PROFILES_DIR,
    explain: true,
    context: {
      newly_diagnosed: true,
      crisis_indicators: true
    }
  });

  assert.ok(compiled.text.includes("directness: medium"));
  assert.deepEqual(compiled.trace.context_matches, ["newly_diagnosed", "crisis_indicators"]);
});

test("compileProfile: pattern selections and interactions are included in explain trace", () => {
  const compiled = compileProfile(profileFile("resolve.yaml"), {
    model: "claude-sonnet",
    bundledProfilesDir: PROFILES_DIR,
    knowledgeBaseDir: KNOWLEDGE_BASE_DIR,
    explain: true
  });

  assert.ok(compiled.text.includes("[PATTERN GUIDANCE]"));
  assert.equal(compiled.trace.pattern_selections.length, 6);
  assert.ok(
    compiled.trace.interaction_patterns.some(
      (interaction) => interaction.id === "warmth-high_directness-high"
    )
  );
  assert.ok(
    compiled.trace.pattern_selections.some((selection) =>
      String(selection.source).startsWith("knowledge-base:")
    )
  );
});

test("compileProfile: strict mode blocks warning-only profiles", () => {
  assert.throws(
    () =>
      compileProfile(profileFile("haven.yaml"), {
        model: "claude-sonnet",
        strict: true,
        bundledProfilesDir: PROFILES_DIR
      }),
    (error) => {
      assert.equal(error.code, "E_COMPILE_VALIDATION");
      assert.equal(error.validation.exitCode, 2);
      return true;
    }
  );
});

test("compileProfile: unsafe fixture fails validation before compile", () => {
  assert.throws(
    () =>
      compileProfile(path.join(PROFILES_DIR, "test-fixtures/_unsafe-s001-test.yaml"), {
        model: "claude-sonnet",
        bundledProfilesDir: PROFILES_DIR
      }),
    (error) => {
      assert.equal(error.code, "E_COMPILE_VALIDATION");
      assert.ok(error.validation.errors.some((diagnostic) => diagnostic.code === "S001"));
      return true;
    }
  );
});
