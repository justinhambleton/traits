import type { DimensionName, Level } from "./types.js";

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
