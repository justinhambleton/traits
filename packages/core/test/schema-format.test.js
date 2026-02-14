import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateProfile,
  validateResolvedProfile
} from "../dist/index.js";
import {
  formatValidationResult,
  toValidationResultObject
} from "../dist/internal.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");

function baseProfile() {
  return {
    schema: "v1.4",
    meta: {
      name: "schema-check",
      version: "1.0.0",
      description: "schema validation fixture"
    },
    identity: {
      role: "Fixture role"
    },
    voice: {
      formality: "medium",
      warmth: "medium",
      verbosity: "medium",
      directness: "medium",
      empathy: "medium",
      humor: {
        target: "low",
        style: "dry"
      }
    },
    behavioral_rules: ["Use clear language"],
    context_adaptations: [
      {
        when: "default",
        inject: ["Keep responses concise"]
      }
    ]
  };
}

test("schema validation accepts reserved sections without error", () => {
  const profile = baseProfile();
  profile.localization = { locale: "en-US" };
  profile.channel_adaptations = { email: { verbosity: "high" } };

  const result = validateResolvedProfile(profile);
  assert.equal(result.errors.length, 0);
  assert.equal(result.checks.schema_structure.status, "pass");
});

test("schema validation catches unknown top-level section", () => {
  const profile = baseProfile();
  profile.unexpected = true;

  const result = validateResolvedProfile(profile);
  assert.ok(
    result.errors.some(
      (diagnostic) =>
        diagnostic.code === "V001" &&
        String(diagnostic.message).includes('Unknown top-level section "unexpected"')
    )
  );
});

test("schema validation catches invalid humor style", () => {
  const profile = baseProfile();
  profile.voice.humor = {
    target: "low",
    style: "banter"
  };

  const result = validateResolvedProfile(profile);
  assert.ok(
    result.errors.some(
      (diagnostic) =>
        diagnostic.code === "V002" &&
        String(diagnostic.message).includes('Invalid humor style "banter"')
    )
  );
});

test("schema validation catches missing floor/ceiling for adaptive dimensions", () => {
  const profile = baseProfile();
  profile.voice.formality = {
    target: "medium",
    adapt: true,
    ceiling: "high"
  };

  const result = validateResolvedProfile(profile);
  assert.ok(
    result.errors.some(
      (diagnostic) =>
        diagnostic.code === "V003" &&
        String(diagnostic.message).includes('requires both floor and ceiling')
    )
  );
  assert.equal(result.checks.adaptation_ranges.status, "error");
});

test("schema validation catches invalid adaptation range ordering", () => {
  const profile = baseProfile();
  profile.context_adaptations = [
    {
      when: "range_error",
      adjustments: {
        directness: {
          target: "low",
          adapt: true,
          floor: "medium",
          ceiling: "high"
        }
      }
    }
  ];

  const result = validateResolvedProfile(profile);
  assert.ok(
    result.errors.some(
      (diagnostic) =>
        diagnostic.code === "V003" &&
        String(diagnostic.message).includes("floor <= target <= ceiling")
    )
  );
});

test("validation formatter provides CLI-ready text and structured object", () => {
  const result = validateProfile(path.join(PROFILES_DIR, "resolve.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });
  const text = formatValidationResult(result);
  const json = toValidationResultObject(result);

  assert.ok(text.includes("✓ Schema valid (v1.4)"));
  assert.ok(text.includes("✓ Composition references resolved"));
  assert.ok(text.includes("Profile is valid."));

  assert.equal(json.exitCode, 0);
  assert.equal(json.isValid, true);
  assert.ok(json.checks.schema_structure);
  assert.ok(Array.isArray(json.diagnostics.errors));
  assert.ok(Array.isArray(json.diagnostics.warnings));
});
