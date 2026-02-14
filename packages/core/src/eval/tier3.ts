import { validateProfile } from "../validator/engine.js";
import { asArray } from "../utils.js";
import { anthropicJudge } from "./providers/anthropic.js";
import { openAIJudge } from "./providers/openai.js";
import type { PersonalityProfile, ValidationResult } from "../types.js";

type EvalSample = {
  id?: string;
  prompt?: string;
  response?: string;
};

type Tier3Options = {
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

function buildJudgeSystemPrompt(includeHelpfulness = true): string {
  const lines = [
    "You are evaluating a model response for personality adherence and helpfulness.",
    "Return strict JSON with numeric fields in [0,1]:",
    "- directness",
    "- warmth_empathy_depth",
    "- humor_appropriateness"
  ];
  if (includeHelpfulness) {
    lines.push("- helpfulness");
  }
  lines.push("- rationale (short string)");
  return lines.join("\n");
}

function buildJudgeUserPrompt(profile: PersonalityProfile, sample: EvalSample): string {
  const voice = profile?.voice ?? {};
  const targetSummary = [
    `formality=${targetLevel(voice.formality)}`,
    `warmth=${targetLevel(voice.warmth)}`,
    `verbosity=${targetLevel(voice.verbosity)}`,
    `directness=${targetLevel(voice.directness)}`,
    `empathy=${targetLevel(voice.empathy)}`,
    `humor=${targetLevel(voice.humor)}`
  ].join(", ");

  return [
    `Profile: ${profile?.meta?.name ?? "unknown"}`,
    `Voice targets: ${targetSummary}`,
    sample?.prompt ? `User prompt: ${sample.prompt}` : "User prompt: (not provided)",
    `Assistant response: ${String(sample?.response ?? "")}`
  ].join("\n");
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
    directness: number;
    warmth_empathy_depth: number;
    humor_appropriateness: number;
    helpfulness: number | null;
    rationale: string;
  }>;
}> {
  const judge = selectJudgeProvider(options);
  const includeHelpfulness = options.includeHelpfulness !== false;
  const systemPrompt = buildJudgeSystemPrompt(includeHelpfulness);
  const items = asArray<EvalSample>(samples);

  const perSample: Array<{
    id: string;
    score: number;
    directness: number;
    warmth_empathy_depth: number;
    humor_appropriateness: number;
    helpfulness: number | null;
    rationale: string;
  }> = [];

  for (const sample of items) {
    const raw = await judge.judgeFn({
      systemPrompt,
      userPrompt: buildJudgeUserPrompt(profile, sample)
    });
    const parsed = extractJSONObject(raw);
    const directness = clamp01(parsed.directness);
    const warmthEmpathyDepth = clamp01(parsed.warmth_empathy_depth);
    const humorAppropriateness = clamp01(parsed.humor_appropriateness);
    const helpfulness = includeHelpfulness ? clamp01(parsed.helpfulness) : null;
    const score = includeHelpfulness
      ? (directness + warmthEmpathyDepth + humorAppropriateness + (helpfulness ?? 0)) / 4
      : (directness + warmthEmpathyDepth + humorAppropriateness) / 3;

    perSample.push({
      id: sample?.id ?? "unknown",
      score,
      directness,
      warmth_empathy_depth: warmthEmpathyDepth,
      humor_appropriateness: humorAppropriateness,
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
