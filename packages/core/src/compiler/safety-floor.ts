import { isClaudeModel } from "../utils.js";

export function getSafetyFloor(model: unknown): string {
  if (isClaudeModel(model)) {
    return [
      "<safety_floor>",
      "Maintain safety refusals for harmful or disallowed requests.",
      "If refusing, be concise, respectful, and provide a safe alternative when possible.",
      "</safety_floor>"
    ].join("\n");
  }

  return [
    "[SAFETY FLOOR]",
    "Maintain refusal behavior for harmful or disallowed requests.",
    "If refusing, be concise, respectful, and provide safe alternatives where possible."
  ].join("\n");
}
