export const PROTECTED_REFUSAL_TERMS = [
  "I can't help with that",
  "I'm not able to",
  "That's not something I can do",
  "I need to decline"
];

function isClaudeModel(model) {
  return /claude/i.test(String(model));
}

export function getSafetyFloor(model) {
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
