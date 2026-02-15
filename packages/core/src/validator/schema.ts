import { DIMENSIONS, LEVEL_INDEX } from "../utils.js";
import type { ValidationCheckSummary, ValidationDiagnostic } from "../types.js";

const HUMOR_STYLES = ["none", "dry", "subtle-wit", "playful"];
const SUPPORTED_SCHEMAS = new Set(["v1.4", "v1.5"]);

const TOP_LEVEL_KEYS = new Set([
  "schema",
  "meta",
  "identity",
  "voice",
  "vocabulary",
  "behavioral_rules",
  "context_adaptations",
  "capabilities",
  "localization",
  "channel_adaptations",
  "extends",
  "behavioral_rules_remove",
  "context_adaptations_remove"
]);

const VOCABULARY_KEYS = new Set([
  "preferred_terms",
  "forbidden_terms",
  "preferred_terms_remove",
  "forbidden_terms_remove"
]);

const CAPABILITIES_KEYS = new Set(["tools", "constraints", "handoff"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function pushDiagnostic(
  target: ValidationDiagnostic[],
  code: string,
  message: string,
  location?: string
): void {
  target.push({
    code,
    severity: "error",
    message: location ? `${message} (${location})` : message,
    location
  });
}

function summarizeDiagnostics(diagnostics: ValidationDiagnostic[]): ValidationCheckSummary {
  return {
    status: diagnostics.length > 0 ? "error" : "pass",
    errors: diagnostics.length,
    warnings: 0
  };
}

function validateScalarField(
  parent: Record<string, unknown>,
  key: string,
  location: string,
  diagnostics: ValidationDiagnostic[]
): void {
  if (!isString(parent?.[key])) {
    pushDiagnostic(
      diagnostics,
      "V001",
      `Expected non-empty string for "${key}"`,
      `${location}.${key}`
    );
  }
}

function validateDimensionValue(
  value: unknown,
  dimension: string,
  location: string,
  dimensionsDiagnostics: ValidationDiagnostic[],
  rangeDiagnostics: ValidationDiagnostic[]
): void {
  if (typeof value === "string") {
    if (!LEVEL_INDEX.has(value as any)) {
      pushDiagnostic(
        dimensionsDiagnostics,
        "V002",
        `Invalid level "${value}" for ${dimension}`,
        location
      );
    }
    return;
  }

  if (!isObject(value)) {
    pushDiagnostic(
      dimensionsDiagnostics,
      "V002",
      `Expected "${dimension}" to be a level string or object`,
      location
    );
    return;
  }

  const allowedObjectKeys =
    dimension === "humor"
      ? new Set(["target", "adapt", "floor", "ceiling", "style"])
      : new Set(["target", "adapt", "floor", "ceiling"]);

  for (const key of Object.keys(value)) {
    if (!allowedObjectKeys.has(key)) {
      pushDiagnostic(
        dimensionsDiagnostics,
        "V002",
        `Unknown dimension property "${key}" for ${dimension}`,
        `${location}.${key}`
      );
    }
  }

  if (!LEVEL_INDEX.has(value.target as any)) {
    pushDiagnostic(
      dimensionsDiagnostics,
      "V002",
      `Invalid target level "${value.target}" for ${dimension}`,
      `${location}.target`
    );
  }

  if (value.adapt != null && typeof value.adapt !== "boolean") {
    pushDiagnostic(
      dimensionsDiagnostics,
      "V002",
      `Expected boolean for ${dimension}.adapt`,
      `${location}.adapt`
    );
  }

  if (value.floor != null && !LEVEL_INDEX.has(value.floor as any)) {
    pushDiagnostic(
      dimensionsDiagnostics,
      "V002",
      `Invalid floor level "${value.floor}" for ${dimension}`,
      `${location}.floor`
    );
  }

  if (value.ceiling != null && !LEVEL_INDEX.has(value.ceiling as any)) {
    pushDiagnostic(
      dimensionsDiagnostics,
      "V002",
      `Invalid ceiling level "${value.ceiling}" for ${dimension}`,
      `${location}.ceiling`
    );
  }

  if (dimension === "humor") {
    if (value.style != null && !HUMOR_STYLES.includes(String(value.style) as any)) {
      pushDiagnostic(
        dimensionsDiagnostics,
        "V002",
        `Invalid humor style "${value.style}"`,
        `${location}.style`
      );
    }
  } else if (value.style != null) {
    pushDiagnostic(
      dimensionsDiagnostics,
      "V002",
      `Style is only allowed on the humor dimension`,
      `${location}.style`
    );
  }

  if (value.adapt === true) {
    if (value.floor == null || value.ceiling == null) {
      pushDiagnostic(
        rangeDiagnostics,
        "V003",
        `Adaptive dimension "${dimension}" requires both floor and ceiling`,
        location
      );
      return;
    }

    if (
      !LEVEL_INDEX.has(value.target as any) ||
      !LEVEL_INDEX.has(value.floor as any) ||
      !LEVEL_INDEX.has(value.ceiling as any)
    ) {
      return;
    }

    const floorIndex = LEVEL_INDEX.get(value.floor as any);
    const targetIndex = LEVEL_INDEX.get(value.target as any);
    const ceilingIndex = LEVEL_INDEX.get(value.ceiling as any);
    if (floorIndex == null || targetIndex == null || ceilingIndex == null) {
      return;
    }
    if (floorIndex > targetIndex || targetIndex > ceilingIndex) {
      pushDiagnostic(
        rangeDiagnostics,
        "V003",
        `Adaptive range must satisfy floor <= target <= ceiling for "${dimension}"`,
        location
      );
    }
  }
}

export function validateSchema(profile: any): {
  diagnostics: ValidationDiagnostic[];
  checks: Record<string, ValidationCheckSummary>;
} {
  const structureDiagnostics: ValidationDiagnostic[] = [];
  const dimensionDiagnostics: ValidationDiagnostic[] = [];
  const rangeDiagnostics: ValidationDiagnostic[] = [];

  if (!isObject(profile)) {
    pushDiagnostic(structureDiagnostics, "V001", "Profile must be a YAML object", "root");
    return {
      diagnostics: [...structureDiagnostics],
      checks: {
        schema_structure: summarizeDiagnostics(structureDiagnostics),
        dimension_values: summarizeDiagnostics(dimensionDiagnostics),
        adaptation_ranges: summarizeDiagnostics(rangeDiagnostics)
      }
    };
  }

  for (const key of Object.keys(profile)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      pushDiagnostic(
        structureDiagnostics,
        "V001",
        `Unknown top-level section "${key}"`,
        key
      );
    }
  }

  if (!isString(profile.schema)) {
    pushDiagnostic(
      structureDiagnostics,
      "V001",
      `Missing required "schema" field`,
      "schema"
    );
  } else if (!SUPPORTED_SCHEMAS.has(profile.schema)) {
    pushDiagnostic(
      structureDiagnostics,
      "V001",
      `Unsupported schema version "${profile.schema}"`,
      "schema"
    );
  }

  if (profile.extends != null && !isString(profile.extends)) {
    pushDiagnostic(
      structureDiagnostics,
      "V001",
      `Expected "extends" to be a non-empty string`,
      "extends"
    );
  }

  if (!isObject(profile.meta)) {
    pushDiagnostic(structureDiagnostics, "V001", `Missing required "meta" section`, "meta");
  } else {
    validateScalarField(profile.meta, "name", "meta", structureDiagnostics);
    validateScalarField(profile.meta, "version", "meta", structureDiagnostics);
    validateScalarField(profile.meta, "description", "meta", structureDiagnostics);

    if (profile.meta.tags != null && !isStringArray(profile.meta.tags)) {
      pushDiagnostic(
        structureDiagnostics,
        "V001",
        `Expected "meta.tags" to be an array of strings`,
        "meta.tags"
      );
    }
    if (profile.meta.target_audience != null && !isString(profile.meta.target_audience)) {
      pushDiagnostic(
        structureDiagnostics,
        "V001",
        `Expected "meta.target_audience" to be a non-empty string`,
        "meta.target_audience"
      );
    }
  }

  if (!isObject(profile.identity)) {
    pushDiagnostic(
      structureDiagnostics,
      "V001",
      `Missing required "identity" section`,
      "identity"
    );
  } else {
    validateScalarField(profile.identity, "role", "identity", structureDiagnostics);
    if (profile.identity.backstory != null && !isString(profile.identity.backstory)) {
      pushDiagnostic(
        structureDiagnostics,
        "V001",
        `Expected "identity.backstory" to be a non-empty string`,
        "identity.backstory"
      );
    }
    if (
      profile.identity.expertise_domains != null &&
      !isStringArray(profile.identity.expertise_domains)
    ) {
      pushDiagnostic(
        structureDiagnostics,
        "V001",
        `Expected "identity.expertise_domains" to be an array of strings`,
        "identity.expertise_domains"
      );
    }
  }

  if (!isObject(profile.voice)) {
    pushDiagnostic(structureDiagnostics, "V001", `Missing required "voice" section`, "voice");
  } else {
    for (const dimension of DIMENSIONS) {
      if (profile.voice[dimension] == null) {
        pushDiagnostic(
          dimensionDiagnostics,
          "V002",
          `Missing required voice dimension "${dimension}"`,
          `voice.${dimension}`
        );
        continue;
      }
      validateDimensionValue(
        profile.voice[dimension],
        dimension,
        `voice.${dimension}`,
        dimensionDiagnostics,
        rangeDiagnostics
      );
    }
  }

  if (profile.vocabulary != null) {
    if (!isObject(profile.vocabulary)) {
      pushDiagnostic(
        structureDiagnostics,
        "V001",
        `Expected "vocabulary" to be an object`,
        "vocabulary"
      );
    } else {
      for (const key of Object.keys(profile.vocabulary)) {
        if (!VOCABULARY_KEYS.has(key)) {
          pushDiagnostic(
            structureDiagnostics,
            "V001",
            `Unknown vocabulary key "${key}"`,
            `vocabulary.${key}`
          );
        }
      }
      if (
        profile.vocabulary.preferred_terms != null &&
        !isStringArray(profile.vocabulary.preferred_terms)
      ) {
        pushDiagnostic(
          structureDiagnostics,
          "V001",
          `Expected "vocabulary.preferred_terms" to be an array of strings`,
          "vocabulary.preferred_terms"
        );
      }
      if (
        profile.vocabulary.forbidden_terms != null &&
        !isStringArray(profile.vocabulary.forbidden_terms)
      ) {
        pushDiagnostic(
          structureDiagnostics,
          "V001",
          `Expected "vocabulary.forbidden_terms" to be an array of strings`,
          "vocabulary.forbidden_terms"
        );
      }
      if (
        profile.vocabulary.preferred_terms_remove != null &&
        !isStringArray(profile.vocabulary.preferred_terms_remove)
      ) {
        pushDiagnostic(
          structureDiagnostics,
          "V001",
          `Expected "vocabulary.preferred_terms_remove" to be an array of strings`,
          "vocabulary.preferred_terms_remove"
        );
      }
      if (
        profile.vocabulary.forbidden_terms_remove != null &&
        !isStringArray(profile.vocabulary.forbidden_terms_remove)
      ) {
        pushDiagnostic(
          structureDiagnostics,
          "V001",
          `Expected "vocabulary.forbidden_terms_remove" to be an array of strings`,
          "vocabulary.forbidden_terms_remove"
        );
      }
    }
  }

  if (profile.behavioral_rules != null && !isStringArray(profile.behavioral_rules)) {
    pushDiagnostic(
      structureDiagnostics,
      "V001",
      `Expected "behavioral_rules" to be an array of strings`,
      "behavioral_rules"
    );
  }

  if (profile.capabilities != null) {
    if (profile.schema !== "v1.5") {
      pushDiagnostic(
        structureDiagnostics,
        "V001",
        `The "capabilities" section requires schema version "v1.5"`,
        "capabilities"
      );
    }

    if (!isObject(profile.capabilities)) {
      pushDiagnostic(
        structureDiagnostics,
        "V001",
        `Expected "capabilities" to be an object`,
        "capabilities"
      );
    } else {
      for (const key of Object.keys(profile.capabilities)) {
        if (!CAPABILITIES_KEYS.has(key)) {
          pushDiagnostic(
            structureDiagnostics,
            "V001",
            `Unknown capabilities key "${key}"`,
            `capabilities.${key}`
          );
        }
      }

      if (!isStringArray(profile.capabilities.tools)) {
        pushDiagnostic(
          structureDiagnostics,
          "V001",
          `Expected "capabilities.tools" to be an array of strings`,
          "capabilities.tools"
        );
      }

      if (!isStringArray(profile.capabilities.constraints)) {
        pushDiagnostic(
          structureDiagnostics,
          "V001",
          `Expected "capabilities.constraints" to be an array of strings`,
          "capabilities.constraints"
        );
      }

      if (!isObject(profile.capabilities.handoff)) {
        pushDiagnostic(
          structureDiagnostics,
          "V001",
          `Expected "capabilities.handoff" to be an object`,
          "capabilities.handoff"
        );
      } else {
        if (!isString(profile.capabilities.handoff.trigger)) {
          pushDiagnostic(
            structureDiagnostics,
            "V001",
            `Expected "capabilities.handoff.trigger" to be a non-empty string`,
            "capabilities.handoff.trigger"
          );
        }
        if (!isString(profile.capabilities.handoff.action)) {
          pushDiagnostic(
            structureDiagnostics,
            "V001",
            `Expected "capabilities.handoff.action" to be a non-empty string`,
            "capabilities.handoff.action"
          );
        }
      }
    }
  }

  if (
    profile.behavioral_rules_remove != null &&
    !isStringArray(profile.behavioral_rules_remove)
  ) {
    pushDiagnostic(
      structureDiagnostics,
      "V001",
      `Expected "behavioral_rules_remove" to be an array of strings`,
      "behavioral_rules_remove"
    );
  }

  if (
    profile.context_adaptations_remove != null &&
    !isStringArray(profile.context_adaptations_remove)
  ) {
    pushDiagnostic(
      structureDiagnostics,
      "V001",
      `Expected "context_adaptations_remove" to be an array of strings`,
      "context_adaptations_remove"
    );
  }

  if (profile.context_adaptations != null) {
    if (!Array.isArray(profile.context_adaptations)) {
      pushDiagnostic(
        structureDiagnostics,
        "V001",
        `Expected "context_adaptations" to be an array`,
        "context_adaptations"
      );
    } else {
      profile.context_adaptations.forEach((adaptation, idx) => {
        const location = `context_adaptations[${idx}]`;
        if (!isObject(adaptation)) {
          pushDiagnostic(
            structureDiagnostics,
            "V001",
            `Expected context adaptation to be an object`,
            location
          );
          return;
        }

        if (!isString(adaptation.when)) {
          pushDiagnostic(
            structureDiagnostics,
            "V001",
            `Context adaptation requires "when"`,
            `${location}.when`
          );
        }

        if (adaptation.priority != null) {
          if (typeof adaptation.priority !== "number" || !Number.isFinite(adaptation.priority)) {
            pushDiagnostic(
              structureDiagnostics,
              "V001",
              `Expected "priority" to be a finite number`,
              `${location}.priority`
            );
          }
        }

        if (adaptation.inject != null && !isStringArray(adaptation.inject)) {
          pushDiagnostic(
            structureDiagnostics,
            "V001",
            `Expected "inject" to be an array of strings`,
            `${location}.inject`
          );
        }

        if (adaptation.adjustments != null) {
          if (!isObject(adaptation.adjustments)) {
            pushDiagnostic(
              structureDiagnostics,
              "V001",
              `Expected "adjustments" to be an object`,
              `${location}.adjustments`
            );
          } else {
            for (const [dimension, value] of Object.entries(adaptation.adjustments)) {
              if (!DIMENSIONS.includes(dimension as any)) {
                pushDiagnostic(
                  dimensionDiagnostics,
                  "V002",
                  `Unknown adaptation dimension "${dimension}"`,
                  `${location}.adjustments.${dimension}`
                );
                continue;
              }
              validateDimensionValue(
                value,
                dimension,
                `${location}.adjustments.${dimension}`,
                dimensionDiagnostics,
                rangeDiagnostics
              );
            }
          }
        }
      });
    }
  }

  const diagnostics = [
    ...structureDiagnostics,
    ...dimensionDiagnostics,
    ...rangeDiagnostics
  ];

  return {
    diagnostics,
    checks: {
      schema_structure: summarizeDiagnostics(structureDiagnostics),
      dimension_values: summarizeDiagnostics(dimensionDiagnostics),
      adaptation_ranges: summarizeDiagnostics(rangeDiagnostics)
    }
  };
}
