import { buildS002Envelopes, gteLevel, lteLevel } from "./extremes.js";

const PROTECTED_REFUSAL_TERMS = [
  "I can't help with that",
  "I'm not able to",
  "That's not something I can do",
  "I need to decline"
];

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

function asArray(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizePhrase(value) {
  return normalizeText(value).toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
}

function collectS001Candidates(profile) {
  const candidates = [];

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

  asArray(profile?.behavioral_rules).forEach((rule, idx) => {
    candidates.push({
      location: `behavioral_rules[${idx}]`,
      text: normalizeText(rule)
    });
  });

  asArray(profile?.context_adaptations).forEach((adaptation, adaptationIdx) => {
    asArray(adaptation?.inject).forEach((rule, injectIdx) => {
      candidates.push({
        location: `context_adaptations[${adaptationIdx}].inject[${injectIdx}]`,
        text: normalizeText(rule)
      });
    });
  });

  return candidates.filter((item) => item.text.length > 0);
}

function collectS005Candidates(profile) {
  const candidates = [];

  asArray(profile?.behavioral_rules).forEach((rule, idx) => {
    candidates.push({
      location: `behavioral_rules[${idx}]`,
      text: normalizeText(rule)
    });
  });

  asArray(profile?.context_adaptations).forEach((adaptation, adaptationIdx) => {
    asArray(adaptation?.inject).forEach((rule, injectIdx) => {
      candidates.push({
        location: `context_adaptations[${adaptationIdx}].inject[${injectIdx}]`,
        text: normalizeText(rule)
      });
    });
  });

  asArray(profile?.vocabulary?.preferred_terms).forEach((term, idx) => {
    candidates.push({
      location: `vocabulary.preferred_terms[${idx}]`,
      text: normalizeText(term)
    });
  });

  asArray(profile?.vocabulary?.forbidden_terms).forEach((term, idx) => {
    candidates.push({
      location: `vocabulary.forbidden_terms[${idx}]`,
      text: normalizeText(term)
    });
  });

  return candidates.filter((item) => item.text.length > 0);
}

function matchPatterns(candidates, patterns, code, severity) {
  const diagnostics = [];

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

function evaluateS002Envelope(envelope) {
  const warnings = [];
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

export function checkS001(profile) {
  return matchPatterns(collectS001Candidates(profile), S001_PATTERNS, "S001", "error");
}

export function checkS002(profile) {
  const triggersByCondition = new Map();
  for (const { source, envelope } of buildS002Envelopes(profile)) {
    const warnings = evaluateS002Envelope(envelope);
    for (const warning of warnings) {
      if (!triggersByCondition.has(warning.id)) {
        triggersByCondition.set(warning.id, {
          reason: warning.reason,
          sources: new Set()
        });
      }
      triggersByCondition.get(warning.id).sources.add(source);
    }
  }

  const diagnostics = [];
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

export function checkS003(profile) {
  const protectedTerms = new Set(PROTECTED_REFUSAL_TERMS.map(normalizePhrase));
  const diagnostics = [];

  for (const forbidden of asArray(profile?.vocabulary?.forbidden_terms)) {
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

export function checkS005(profile) {
  return matchPatterns(collectS005Candidates(profile), S005_PATTERNS, "S005", "warning");
}
