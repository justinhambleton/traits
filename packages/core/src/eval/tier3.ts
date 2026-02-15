import { validateProfile } from "../validator/engine.js";
import { asArray, DIMENSIONS, normalizeRuleConstraints } from "../utils.js";
import { anthropicJudge } from "./providers/anthropic.js";
import { openAIJudge } from "./providers/openai.js";
import type { PersonalityProfile, ValidationResult } from "../types.js";
import type { EvalSample } from "./types.js";

export type Tier3Options = {
  includeHelpfulness?: boolean;
  strict?: boolean;
  bundledProfilesDir?: string;
  provider?: string;
  judgeFn?: (args: { systemPrompt: string; userPrompt: string }) => Promise<string>;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  judgeModel?: string;
  openaiBaseUrl?: string;
  openAIBaseUrl?: string;
  anthropicBaseUrl?: string;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
  fetchMaxRetries?: number;
  fetchRetryBaseMs?: number;
};

type JudgeProvider = {
  provider: string;
  judgeFn: (args: { systemPrompt: string; userPrompt: string }) => Promise<string>;
};

type DimensionName = (typeof DIMENSIONS)[number];

type DimensionScores = {
  formality: number;
  warmth: number;
  verbosity: number;
  directness: number;
  empathy: number;
  humor: number;
};

const SCORING_DIMENSIONS: DimensionName[] = [
  "formality",
  "warmth",
  "verbosity",
  "directness",
  "empathy",
  "humor"
];

function targetLevel(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { target?: unknown }).target === "string") {
    return (value as { target: string }).target;
  }
  return "medium";
}

function clamp01(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function extractJSONObject(text: unknown): Record<string, unknown> {
  const raw = String(text ?? "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Judge response did not contain JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function selectJudgeProvider(options: Tier3Options = {}): JudgeProvider {
  if (typeof options.judgeFn === "function") {
    return {
      provider: "custom",
      judgeFn: options.judgeFn
    };
  }

  const requested = String(options.provider ?? "auto").toLowerCase();
  const openaiKey = options.openaiApiKey ?? process.env.TRAITS_OPENAI_API_KEY;
  const anthropicKey = options.anthropicApiKey ?? process.env.TRAITS_ANTHROPIC_API_KEY;

  if (requested === "openai" || (requested === "auto" && openaiKey)) {
    if (!openaiKey) {
      const error = new Error("Tier 3 requested OpenAI provider but TRAITS_OPENAI_API_KEY is missing.");
      (error as Error & { code?: string }).code = "E_EVAL_TIER3_UNAVAILABLE";
      throw error;
    }
    return {
      provider: "openai",
      judgeFn: ({ systemPrompt, userPrompt }) =>
        openAIJudge({
          apiKey: openaiKey,
          systemPrompt,
          userPrompt,
          model: options.judgeModel ?? "gpt-4o-mini",
          baseUrl: options.openaiBaseUrl ?? options.openAIBaseUrl,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.fetchTimeoutMs,
          maxRetries: options.fetchMaxRetries,
          retryBaseMs: options.fetchRetryBaseMs
        })
    };
  }

  if (requested === "anthropic" || (requested === "auto" && anthropicKey)) {
    if (!anthropicKey) {
      const error = new Error(
        "Tier 3 requested Anthropic provider but TRAITS_ANTHROPIC_API_KEY is missing."
      );
      (error as Error & { code?: string }).code = "E_EVAL_TIER3_UNAVAILABLE";
      throw error;
    }
    return {
      provider: "anthropic",
      judgeFn: ({ systemPrompt, userPrompt }) =>
        anthropicJudge({
          apiKey: anthropicKey,
          systemPrompt,
          userPrompt,
          model: options.judgeModel ?? "claude-3-5-sonnet-latest",
          baseUrl: options.anthropicBaseUrl,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.fetchTimeoutMs,
          maxRetries: options.fetchMaxRetries,
          retryBaseMs: options.fetchRetryBaseMs
        })
    };
  }

  const error = new Error(
    "Tier 3 requires TRAITS_OPENAI_API_KEY or TRAITS_ANTHROPIC_API_KEY."
  );
  (error as Error & { code?: string }).code = "E_EVAL_TIER3_UNAVAILABLE";
  throw error;
}

function collectVoiceTargets(profile: PersonalityProfile): Record<DimensionName, string> {
  const voice = profile?.voice ?? {};
  return {
    formality: targetLevel(voice.formality),
    warmth: targetLevel(voice.warmth),
    verbosity: targetLevel(voice.verbosity),
    directness: targetLevel(voice.directness),
    empathy: targetLevel(voice.empathy),
    humor: targetLevel(voice.humor)
  };
}

function buildJudgeSystemPrompt(
  profile: PersonalityProfile,
  includeHelpfulness = true
): string {
  const targets = collectVoiceTargets(profile);
  const lines = [
    "You are evaluating personality target adherence for a single assistant response.",
    "Score adherence to the stated target level for each dimension, not generic response quality.",
    "Scoring scale per dimension:",
    "- 1.0: response clearly matches target level",
    "- 0.5: partially aligned or ambiguous",
    "- 0.0: clearly misaligned/opposite target",
    "Example: if humor target is very-low, a response with no humor should score 1.0 because it matches target adherence.",
    "Voice targets to score:",
    `- formality (target: ${targets.formality})`,
    `- warmth (target: ${targets.warmth})`,
    `- verbosity (target: ${targets.verbosity})`,
    `- directness (target: ${targets.directness})`,
    `- empathy (target: ${targets.empathy})`,
    `- humor (target: ${targets.humor})`
  ];

  if (includeHelpfulness) {
    lines.push(
      "Also score helpfulness in [0,1] based on actionable utility and correctness intent."
    );
  } else {
    lines.push("Helpfulness scoring is disabled for this run.");
  }

  lines.push(
    "Return strict JSON only with numeric fields in [0,1] and a short rationale string.",
    includeHelpfulness
      ? '{"formality":0,"warmth":0,"verbosity":0,"directness":0,"empathy":0,"humor":0,"helpfulness":0,"rationale":"..."}'
      : '{"formality":0,"warmth":0,"verbosity":0,"directness":0,"empathy":0,"humor":0,"rationale":"..."}'
  );

  return lines.join("\n");
}

function buildJudgeUserPrompt(profile: PersonalityProfile, sample: EvalSample): string {
  const targets = collectVoiceTargets(profile);
  const preferredTerms = asArray<string>(profile?.vocabulary?.preferred_terms);
  const forbiddenTerms = asArray<string>(profile?.vocabulary?.forbidden_terms);
  const behavioralRules = normalizeRuleConstraints(profile?.behavioral_rules).map(
    (entry) => entry.rule
  );

  return [
    `Profile: ${profile?.meta?.name ?? "unknown"}`,
    `Role: ${profile?.identity?.role ?? "assistant"}`,
    `Voice targets: ${JSON.stringify(targets)}`,
    preferredTerms.length > 0
      ? `Preferred terms: ${preferredTerms.join("; ")}`
      : "Preferred terms: (none)",
    forbiddenTerms.length > 0
      ? `Forbidden terms: ${forbiddenTerms.join("; ")}`
      : "Forbidden terms: (none)",
    behavioralRules.length > 0
      ? `Behavioral rules: ${behavioralRules.join("; ")}`
      : "Behavioral rules: (none)",
    sample?.prompt ? `User prompt: ${sample.prompt}` : "User prompt: (not provided)",
    `Assistant response: ${String(sample?.response ?? "")}`
  ].join("\n");
}

function parseDimensionScores(parsed: Record<string, unknown>): DimensionScores {
  return {
    formality: clamp01(parsed.formality),
    warmth: clamp01(parsed.warmth),
    verbosity: clamp01(parsed.verbosity),
    directness: clamp01(parsed.directness),
    empathy: clamp01(parsed.empathy),
    humor: clamp01(parsed.humor)
  };
}

function averageDimensionScores(scores: DimensionScores): number {
  const total = SCORING_DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension], 0);
  return total / SCORING_DIMENSIONS.length;
}

export async function runTier3Evaluation(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options: Tier3Options = {}
): Promise<{
  tier: number;
  provider: string;
  helpfulness_included: boolean;
  sample_count: number;
  average_score: number;
  samples: Array<{
    id: string;
    score: number;
    dimension_average: number;
    formality: number;
    warmth: number;
    verbosity: number;
    directness: number;
    empathy: number;
    humor: number;
    helpfulness: number | null;
    rationale: string;
  }>;
}> {
  const judge = selectJudgeProvider(options);
  const includeHelpfulness = options.includeHelpfulness !== false;
  const systemPrompt = buildJudgeSystemPrompt(profile, includeHelpfulness);
  const items = asArray<EvalSample>(samples);

  const perSample: Array<{
    id: string;
    score: number;
    dimension_average: number;
    formality: number;
    warmth: number;
    verbosity: number;
    directness: number;
    empathy: number;
    humor: number;
    helpfulness: number | null;
    rationale: string;
  }> = [];

  for (const sample of items) {
    const raw = await judge.judgeFn({
      systemPrompt,
      userPrompt: buildJudgeUserPrompt(profile, sample)
    });
    const parsed = extractJSONObject(raw);
    const dimensions = parseDimensionScores(parsed);
    const dimensionAverage = averageDimensionScores(dimensions);
    const helpfulness = includeHelpfulness ? clamp01(parsed.helpfulness) : null;
    const score = includeHelpfulness
      ? clamp01(0.7 * dimensionAverage + 0.3 * (helpfulness ?? 0))
      : clamp01(dimensionAverage);

    perSample.push({
      id: sample?.id ?? "unknown",
      score,
      dimension_average: dimensionAverage,
      ...dimensions,
      helpfulness,
      rationale: String(parsed.rationale ?? "")
    });
  }

  const averageScore =
    perSample.length === 0
      ? 0
      : perSample.reduce((sum, sample) => sum + sample.score, 0) / perSample.length;

  return {
    tier: 3,
    provider: judge.provider,
    helpfulness_included: includeHelpfulness,
    sample_count: perSample.length,
    average_score: averageScore,
    samples: perSample
  };
}

export async function runTier3EvaluationForProfile(
  profilePath: string,
  samples: EvalSample[],
  options: Tier3Options = {}
): Promise<{
  validation: ValidationResult;
  report: Awaited<ReturnType<typeof runTier3Evaluation>>;
}> {
  const validation = validateProfile(profilePath, {
    strict: Boolean(options.strict),
    bundledProfilesDir: options.bundledProfilesDir
  });
  if (validation.effectiveErrors.length > 0) {
    const error = new Error("Profile failed validation for eval.");
    (error as Error & { code?: string; validation?: unknown }).code = "E_EVAL_VALIDATION";
    (error as Error & { code?: string; validation?: unknown }).validation = validation;
    throw error;
  }

  if (!validation.profile) {
    const error = new Error("Profile failed validation for eval.");
    (error as Error & { code?: string; validation?: unknown }).code = "E_EVAL_VALIDATION";
    (error as Error & { code?: string; validation?: unknown }).validation = validation;
    throw error;
  }

  const report = await runTier3Evaluation(validation.profile, samples, options);
  return {
    validation,
    report
  };
}
