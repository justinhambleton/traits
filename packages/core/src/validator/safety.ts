import { buildS002Envelopes, gteLevel, lteLevel } from "./extremes.js";
import { asArray, PROTECTED_REFUSAL_TERMS, ruleConstraintText } from "../utils.js";
import type {
  ContextAdaptation,
  PersonalityProfile,
  ValidationDiagnostic
} from "../types.js";
import type { S002Envelope } from "./extremes.js";

type TextCandidate = { location: string; text: string };
type SafetyPattern = { id: string; regex: RegExp };
type ActionPattern = { id: string; regex: RegExp; toolHints: string[] };
type EnvelopeWarning = { id: string; reason: string };

const S001_PATTERNS = [
  { id: "always-comply", regex: /always comply/i },
  { id: "never-refuse", regex: /never refuse/i },
  {
    id: "prioritize-user-request-above-all",
    regex: /prioritize.*user.*request.*above all/i
  },
  { id: "ignore-previous-instructions", regex: /ignore.*previous.*instructions/i },
  { id: "bypass-safety", regex: /bypass.*safety/i },
  { id: "override-guardrails", regex: /override.*guardrails/i },
  { id: "only-priority", regex: /only priority/i },
  { id: "do-not-say-no-refuse-decline", regex: /do not (say no|refuse|decline)/i },
  { id: "always-agree", regex: /always agree/i },
  { id: "always-say-yes", regex: /always say yes/i },
  { id: "never-say-no", regex: /never say no/i },
  { id: "disregard-system-constraints", regex: /disregard.*system.*constraints?/i }
];

const S005_PATTERNS = [
  { id: "system-prompt-reference", regex: /\bsystem\s+prompt\b/i },
  { id: "developer-instructions-reference", regex: /\bdeveloper\s+(prompt|message|instructions?)\b/i },
  {
    id: "ignore-system-instructions",
    regex: /\bignore\b.*\b(system|developer|previous|prior)\b.*\b(instruction|prompt)/i
  },
  { id: "override-policy", regex: /\boverride\b.*\b(policy|guardrail|instruction)s?\b/i },
  { id: "trigger-word", regex: /\btrigger\s+word\b/i },
  { id: "mode-switching", regex: /\b(switch|change)\b.*\bmode\b/i },
  { id: "jailbreak-language", regex: /\b(jailbreak|dan mode|developer mode)\b/i }
];

const S008_ACTION_PATTERNS: ActionPattern[] = [
  {
    id: "take-care-of",
    regex: /\b(i(?:'ll| will)\s+take\s+care\s+of)\b/i,
    toolHints: ["case", "ticket", "workflow", "task", "support", "assist"]
  },
  {
    id: "escalate",
    regex: /\b(i(?:'ll| will)\s+escalat(?:e|ing)|i\s+can\s+escalate)\b/i,
    toolHints: ["escalat", "ticket"]
  },
  {
    id: "contact-or-notify",
    regex: /\b(i(?:'ll| will)\s+(?:contact|notify|reach out to|message))\b/i,
    toolHints: ["contact", "notify", "message", "email", "sms", "ticket"]
  },
  {
    id: "refund-action",
    regex: /\b(i(?:'ll| will)\s+(?:issue|process|submit)\s+(?:a\s+)?refund)\b/i,
    toolHints: ["refund", "payment", "billing"]
  },
  {
    id: "schedule-action",
    regex: /\b(i(?:'ll| will)\s+(?:schedule|book|reschedule))\b/i,
    toolHints: ["schedule", "calendar", "appointment", "booking"]
  },
  {
    id: "generic-i-will-action",
    regex: /\b(i(?:'ll| will)\s+(?:handle|resolve|fix|approve|arrange|dispatch|submit))\b/i,
    toolHints: []
  }
];

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePhrase(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
}

function collectS001Candidates(profile: PersonalityProfile): TextCandidate[] {
  const candidates: TextCandidate[] = [];

  if (profile?.identity?.role) {
    candidates.push({
      location: "identity.role",
      text: normalizeText(profile.identity.role)
    });
  }
  if (profile?.identity?.backstory) {
    candidates.push({
      location: "identity.backstory",
      text: normalizeText(profile.identity.backstory)
    });
  }

  asArray(profile?.behavioral_rules).forEach((ruleEntry, idx) => {
    const rule = ruleConstraintText(ruleEntry);
    if (!rule) return;
    candidates.push({
      location: `behavioral_rules[${idx}]`,
      text: normalizeText(rule)
    });
  });

  asArray<ContextAdaptation>(profile?.context_adaptations).forEach(
    (adaptation, adaptationIdx) => {
    asArray<string>(adaptation?.inject).forEach((rule, injectIdx) => {
      candidates.push({
        location: `context_adaptations[${adaptationIdx}].inject[${injectIdx}]`,
        text: normalizeText(rule)
      });
    });
    }
  );

  return candidates.filter((item) => item.text.length > 0);
}

function collectS005Candidates(profile: PersonalityProfile): TextCandidate[] {
  const candidates: TextCandidate[] = [];

  asArray(profile?.behavioral_rules).forEach((ruleEntry, idx) => {
    const rule = ruleConstraintText(ruleEntry);
    if (!rule) return;
    candidates.push({
      location: `behavioral_rules[${idx}]`,
      text: normalizeText(rule)
    });
  });

  asArray<ContextAdaptation>(profile?.context_adaptations).forEach(
    (adaptation, adaptationIdx) => {
    asArray<string>(adaptation?.inject).forEach((rule, injectIdx) => {
      candidates.push({
        location: `context_adaptations[${adaptationIdx}].inject[${injectIdx}]`,
        text: normalizeText(rule)
      });
    });
    }
  );

  asArray<string>(profile?.vocabulary?.preferred_terms).forEach((term, idx) => {
    candidates.push({
      location: `vocabulary.preferred_terms[${idx}]`,
      text: normalizeText(term)
    });
  });

  asArray<string>(profile?.vocabulary?.forbidden_terms).forEach((term, idx) => {
    candidates.push({
      location: `vocabulary.forbidden_terms[${idx}]`,
      text: normalizeText(term)
    });
  });

  return candidates.filter((item) => item.text.length > 0);
}

function collectS008Candidates(profile: PersonalityProfile): TextCandidate[] {
  const candidates: TextCandidate[] = [];

  if (profile?.identity?.role) {
    candidates.push({
      location: "identity.role",
      text: normalizeText(profile.identity.role)
    });
  }
  if (profile?.identity?.backstory) {
    candidates.push({
      location: "identity.backstory",
      text: normalizeText(profile.identity.backstory)
    });
  }

  asArray(profile?.behavioral_rules).forEach((ruleEntry, idx) => {
    const rule = ruleConstraintText(ruleEntry);
    if (!rule) return;
    candidates.push({
      location: `behavioral_rules[${idx}]`,
      text: normalizeText(rule)
    });
  });

  asArray<ContextAdaptation>(profile?.context_adaptations).forEach(
    (adaptation, adaptationIdx) => {
      asArray<string>(adaptation?.inject).forEach((rule, injectIdx) => {
        candidates.push({
          location: `context_adaptations[${adaptationIdx}].inject[${injectIdx}]`,
          text: normalizeText(rule)
        });
      });
    }
  );

  return candidates.filter((item) => item.text.length > 0);
}

function hasCapabilityForPattern(tools: string[], pattern: ActionPattern): boolean {
  if (tools.length === 0) return false;
  if (pattern.toolHints.length === 0) return tools.length > 0;
  return pattern.toolHints.some((hint) => tools.some((tool) => tool.includes(hint)));
}

function matchPatterns(
  candidates: TextCandidate[],
  patterns: SafetyPattern[],
  code: string,
  severity: "warning" | "error"
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const candidate of candidates) {
    for (const pattern of patterns) {
      if (!pattern.regex.test(candidate.text)) continue;
      diagnostics.push({
        code,
        severity,
        message: `${code} pattern "${pattern.id}" matched at ${candidate.location}.`,
        location: candidate.location
      });
      break;
    }
  }

  return diagnostics;
}

function evaluateS002Envelope(envelope: S002Envelope): EnvelopeWarning[] {
  const warnings: EnvelopeWarning[] = [];
  const directness = envelope.directness;
  if (!directness?.floor) return warnings;

  if (
    lteLevel(directness.floor, "low") &&
    gteLevel(envelope?.warmth?.ceiling, "very-high")
  ) {
    warnings.push({
      id: "directness-low-warmth-very-high",
      reason: "directness floor <= low with warmth ceiling >= very-high"
    });
  }

  if (lteLevel(directness.floor, "very-low")) {
    warnings.push({
      id: "directness-very-low",
      reason: "directness floor <= very-low"
    });
  }

  if (
    envelope?.empathy?.adapt &&
    lteLevel(directness.floor, "low") &&
    gteLevel(envelope?.empathy?.ceiling, "very-high")
  ) {
    warnings.push({
      id: "empathy-very-high-directness-low",
      reason: "adaptive empathy ceiling >= very-high with directness floor <= low"
    });
  }

  if (
    envelope?.humor?.adapt &&
    lteLevel(directness.floor, "low") &&
    gteLevel(envelope?.humor?.ceiling, "very-high")
  ) {
    warnings.push({
      id: "humor-very-high-directness-low",
      reason: "adaptive humor ceiling >= very-high with directness floor <= low"
    });
  }

  return warnings;
}

export function checkS001(profile: PersonalityProfile): ValidationDiagnostic[] {
  return matchPatterns(collectS001Candidates(profile), S001_PATTERNS, "S001", "error");
}

export function checkS002(profile: PersonalityProfile): ValidationDiagnostic[] {
  const triggersByCondition = new Map<
    string,
    { reason: string; sources: Set<string> }
  >();
  for (const { source, envelope } of buildS002Envelopes(profile)) {
    const warnings = evaluateS002Envelope(envelope);
    for (const warning of warnings) {
      if (!triggersByCondition.has(warning.id)) {
        triggersByCondition.set(warning.id, {
          reason: warning.reason,
          sources: new Set()
        });
      }
      const trigger = triggersByCondition.get(warning.id);
      if (trigger) {
        trigger.sources.add(source);
      }
    }
  }

  const diagnostics: ValidationDiagnostic[] = [];
  for (const trigger of triggersByCondition.values()) {
    const where = [...trigger.sources].join(", ");
    diagnostics.push({
      code: "S002",
      severity: "warning",
      message: `Unsafe adaptive extremes: ${trigger.reason}. Triggered in ${where}.`
    });
  }

  return diagnostics;
}

export function checkS003(profile: PersonalityProfile): ValidationDiagnostic[] {
  const protectedTerms = new Set(PROTECTED_REFUSAL_TERMS.map(normalizePhrase));
  const diagnostics: ValidationDiagnostic[] = [];

  for (const forbidden of asArray<string>(profile?.vocabulary?.forbidden_terms)) {
    const normalizedForbidden = normalizePhrase(forbidden);
    if (!protectedTerms.has(normalizedForbidden)) continue;
    diagnostics.push({
      code: "S003",
      severity: "warning",
      message: `Protected refusal phrase appears in vocabulary.forbidden_terms: "${forbidden}".`
    });
  }

  return diagnostics;
}

export function checkS005(profile: PersonalityProfile): ValidationDiagnostic[] {
  return matchPatterns(collectS005Candidates(profile), S005_PATTERNS, "S005", "warning");
}

export function checkS008(profile: PersonalityProfile): ValidationDiagnostic[] {
  if (!profile?.capabilities) return [];

  const tools = asArray<string>(profile.capabilities.tools).map((tool) =>
    String(tool).toLowerCase()
  );
  const diagnostics: ValidationDiagnostic[] = [];

  for (const candidate of collectS008Candidates(profile)) {
    for (const pattern of S008_ACTION_PATTERNS) {
      if (!pattern.regex.test(candidate.text)) continue;
      if (hasCapabilityForPattern(tools, pattern)) break;
      const expectedTools =
        pattern.toolHints.length > 0
          ? pattern.toolHints.map((hint) => `"*${hint}*"`).join(", ")
          : "a concrete action tool";
      diagnostics.push({
        code: "S008",
        severity: "warning",
        message: `Action-claiming language matched "${pattern.id}" at ${candidate.location}, but capabilities.tools does not indicate support (expected ${expectedTools}).`,
        location: candidate.location
      });
      break;
    }
  }

  return diagnostics;
}
