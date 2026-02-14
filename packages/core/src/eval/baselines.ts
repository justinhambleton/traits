import { runTier1Evaluation } from "./tier1.js";
import { asArray } from "../utils.js";
import type { PersonalityProfile } from "../types.js";

type EvalSample = {
  id?: string;
  prompt?: string;
  response?: string;
};

type NormalizedSample = {
  id: string;
  prompt?: string;
  response: string;
};

type OfflineBaselineOptions = {
  includeHelpfulness?: boolean;
  compiledTier1Report?: {
    average_score?: number;
  } | null;
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return fallback;
}

function firstSentence(value: unknown): string {
  const text = asString(value);
  if (!text) return "";
  const match = text.match(/(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? text).trim();
}

function normalizeSamples(samples: EvalSample[]): NormalizedSample[] {
  return asArray<EvalSample>(samples).map((sample, index) => ({
    id: sample?.id ?? `sample-${index + 1}`,
    prompt: sample?.prompt != null ? String(sample.prompt) : undefined,
    response: sample?.response != null ? String(sample.response) : ""
  }));
}

function buildNoneBaselineResponses(samples: NormalizedSample[]): NormalizedSample[] {
  return samples.map((sample) => ({
    id: sample.id,
    prompt: sample.prompt,
    response: "I can help with that."
  }));
}

function buildBasicBaselineResponses(
  profile: PersonalityProfile,
  samples: NormalizedSample[]
): NormalizedSample[] {
  const role = asString(profile?.identity?.role, "assistant");
  const rolePhrase =
    role.toLowerCase() === "assistant" ? "assistant" : role.toLowerCase();
  const backstorySummary = firstSentence(profile?.identity?.backstory);

  return samples.map((sample) => {
    const responseParts = [`As a ${rolePhrase}, I can help with this.`];
    if (backstorySummary) {
      responseParts.push(backstorySummary);
    }
    return {
      id: sample.id,
      prompt: sample.prompt,
      response: responseParts.join(" ")
    };
  });
}

function delta(value: unknown, baseline: unknown): number | null {
  const lhs = Number(value);
  const rhs = Number(baseline);
  if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) return null;
  return lhs - rhs;
}

export function runOfflineBaselineScaffold(
  profile: PersonalityProfile,
  samples: EvalSample[],
  options: OfflineBaselineOptions = {}
): {
  type: string;
  deterministic: boolean;
  helpfulness_included: boolean;
  tier1: {
    none: ReturnType<typeof runTier1Evaluation>;
    basic: ReturnType<typeof runTier1Evaluation>;
    deltas: {
      basic_vs_none: number | null;
      compiled_vs_none: number | null;
      compiled_vs_basic: number | null;
    };
  };
} {
  const normalizedSamples = normalizeSamples(samples);
  const includeHelpfulness = options.includeHelpfulness !== false;
  const tier1Options = { includeHelpfulness };

  const noneSamples = buildNoneBaselineResponses(normalizedSamples);
  const basicSamples = buildBasicBaselineResponses(profile, normalizedSamples);

  const noneTier1 = runTier1Evaluation(profile, noneSamples, tier1Options);
  const basicTier1 = runTier1Evaluation(profile, basicSamples, tier1Options);

  const compiledTier1Average = Number(options?.compiledTier1Report?.average_score);

  return {
    type: "offline-scaffold",
    deterministic: true,
    helpfulness_included: includeHelpfulness,
    tier1: {
      none: noneTier1,
      basic: basicTier1,
      deltas: {
        basic_vs_none: delta(basicTier1.average_score, noneTier1.average_score),
        compiled_vs_none: Number.isFinite(compiledTier1Average)
          ? delta(compiledTier1Average, noneTier1.average_score)
          : null,
        compiled_vs_basic: Number.isFinite(compiledTier1Average)
          ? delta(compiledTier1Average, basicTier1.average_score)
          : null
      }
    }
  };
}
