import { asArray } from "../utils.js";

export type EvalScenarioCategory =
  | "standard"
  | "frustrated"
  | "edge"
  | "multi-turn"
  | "formal"
  | "casual"
  | "mixed";

export type EvalScenarioMessage = {
  role: "user" | "assistant";
  content: string;
};

export type EvalScenario = {
  id: string;
  category: EvalScenarioCategory;
  domain?: string;
  messages: EvalScenarioMessage[];
  expected_behavior?: string;
};

const VALID_CATEGORIES = new Set([
  "standard",
  "frustrated",
  "edge",
  "multi-turn",
  "formal",
  "casual",
  "mixed"
]);

const VALID_ROLES = new Set(["user", "assistant"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateEvalScenario(scenario: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isObject(scenario)) {
    return {
      valid: false,
      errors: ["Scenario must be an object"]
    };
  }

  if (!isNonEmptyString(scenario.id)) {
    errors.push('Scenario is missing required "id"');
  }

  if (!isNonEmptyString(scenario.category) || !VALID_CATEGORIES.has(scenario.category)) {
    errors.push(
      `Scenario category must be one of: ${Array.from(VALID_CATEGORIES).join(", ")}`
    );
  }

  const messages = asArray<EvalScenarioMessage>(scenario.messages);
  if (messages.length === 0) {
    errors.push('Scenario must include at least one message in "messages"');
  } else {
    messages.forEach((message, index) => {
      if (!isObject(message)) {
        errors.push(`messages[${index}] must be an object`);
        return;
      }
      if (!isNonEmptyString(message.role) || !VALID_ROLES.has(message.role)) {
        errors.push(`messages[${index}].role must be "user" or "assistant"`);
      }
      if (!isNonEmptyString(message.content)) {
        errors.push(`messages[${index}].content must be a non-empty string`);
      }
    });
  }

  if (scenario.domain != null && !isNonEmptyString(scenario.domain)) {
    errors.push('"domain" must be a non-empty string when provided');
  }
  if (
    scenario.expected_behavior != null &&
    !isNonEmptyString(scenario.expected_behavior)
  ) {
    errors.push('"expected_behavior" must be a non-empty string when provided');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateEvalScenarios(scenarios: unknown): {
  valid: boolean;
  count: number;
  invalid: Array<{ index: number; id: string | null; errors: string[] }>;
} {
  const input = asArray<EvalScenario>(scenarios);
  const invalid: Array<{ index: number; id: string | null; errors: string[] }> = [];
  input.forEach((scenario, index) => {
    const result = validateEvalScenario(scenario);
    if (result.valid) return;
    invalid.push({
      index,
      id: scenario?.id ?? null,
      errors: result.errors
    });
  });

  return {
    valid: invalid.length === 0,
    count: input.length,
    invalid
  };
}
