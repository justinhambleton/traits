import type { DimensionName, Level, LockedRule, RuleConstraint } from "./types.js";

export const LEVELS: Level[] = ["very-low", "low", "medium", "high", "very-high"];
export const LEVEL_ORDER: Level[] = LEVELS;
export const LEVEL_INDEX = new Map<Level, number>(
  LEVEL_ORDER.map((level, idx) => [level, idx])
);

export const DIMENSIONS: DimensionName[] = [
  "formality",
  "warmth",
  "verbosity",
  "directness",
  "empathy",
  "humor"
];

export const PROTECTED_REFUSAL_TERMS = [
  "I can't help with that",
  "I'm not able to",
  "That's not something I can do",
  "I need to decline"
];

export function asArray<T = unknown>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function isClaudeModel(model: unknown): boolean {
  return /claude/i.test(String(model ?? ""));
}

export function isGptModel(model: unknown): boolean {
  return /gpt/i.test(String(model ?? ""));
}

export function isLockedRule(value: unknown): value is LockedRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.rule !== "string" || candidate.rule.trim().length === 0) return false;
  if (candidate.locked != null && typeof candidate.locked !== "boolean") return false;
  return true;
}

export function ruleConstraintText(entry: unknown): string | null {
  if (typeof entry === "string") {
    const text = entry.trim();
    return text.length > 0 ? text : null;
  }
  if (isLockedRule(entry)) {
    return entry.rule.trim();
  }
  return null;
}

export function normalizeRuleConstraints(value: unknown): Array<{ rule: string; locked: boolean }> {
  const out: Array<{ rule: string; locked: boolean }> = [];
  for (const entry of asArray<RuleConstraint>(value)) {
    if (typeof entry === "string") {
      const text = entry.trim();
      if (!text) continue;
      out.push({ rule: text, locked: false });
      continue;
    }
    if (!isLockedRule(entry)) continue;
    out.push({ rule: entry.rule.trim(), locked: Boolean(entry.locked) });
  }
  return out;
}
