type TierState = {
  tier: number;
  available: boolean;
  implemented: boolean;
  reason: string;
};

function resolveTier3Availability(
  providerPreference: unknown,
  hasOpenAI: boolean,
  hasAnthropic: boolean
): { available: boolean; reason: string } {
  const provider = String(providerPreference ?? "auto").toLowerCase();

  if (provider === "openai") {
    return {
      available: hasOpenAI,
      reason: hasOpenAI
        ? "Judge-model checks are available via OpenAI."
        : "Tier 3 with OpenAI requires TRAITS_OPENAI_API_KEY."
    };
  }

  if (provider === "anthropic") {
    return {
      available: hasAnthropic,
      reason: hasAnthropic
        ? "Judge-model checks are available via Anthropic."
        : "Tier 3 with Anthropic requires TRAITS_ANTHROPIC_API_KEY."
    };
  }

  return {
    available: hasOpenAI || hasAnthropic,
    reason: hasOpenAI || hasAnthropic
      ? "Judge-model checks are available via OpenAI or Anthropic."
      : "Tier 3 requires TRAITS_OPENAI_API_KEY or TRAITS_ANTHROPIC_API_KEY."
  };
}

export function detectEvalTierAvailability(
  env: Record<string, string | undefined> = process.env,
  options: { provider?: string } = {}
): Record<number, TierState> {
  const hasOpenAI = Boolean(env.TRAITS_OPENAI_API_KEY);
  const hasAnthropic = Boolean(env.TRAITS_ANTHROPIC_API_KEY);
  const tier3 = resolveTier3Availability(options.provider, hasOpenAI, hasAnthropic);

  return {
    1: {
      tier: 1,
      available: true,
      implemented: true,
      reason: "Local deterministic checks are available."
    },
    2: {
      tier: 2,
      available: hasOpenAI,
      implemented: true,
      reason: hasOpenAI
        ? "OpenAI embedding checks are available."
        : "Tier 2 requires TRAITS_OPENAI_API_KEY."
    },
    3: {
      tier: 3,
      available: tier3.available,
      implemented: true,
      reason: tier3.reason
    }
  };
}

export function resolveTierExecution(
  requestedTier: number | string,
  availability: Record<number, TierState>
): {
  tier_requested: number;
  tier_executed: number;
  tiers_run: number[];
  blocked: Array<{
    tier: number;
    available: boolean;
    implemented: boolean;
    reason: string;
  }>;
} {
  const requested = Number(requestedTier);
  const tiersRun: number[] = [];
  for (let tier = 1; tier <= requested; tier += 1) {
    const state = availability?.[tier];
    if (state?.available && state?.implemented) {
      tiersRun.push(tier);
    }
  }
  const tierExecuted = tiersRun.length > 0 ? Math.max(...tiersRun) : 0;

  const blocked: Array<{
    tier: number;
    available: boolean;
    implemented: boolean;
    reason: string;
  }> = [];
  for (let tier = 1; tier <= requested; tier += 1) {
    if (tiersRun.includes(tier)) continue;
    const state = availability?.[tier];
    blocked.push({
      tier,
      available: Boolean(state?.available),
      implemented: Boolean(state?.implemented),
      reason: state?.reason ?? "Unavailable tier"
    });
  }

  return {
    tier_requested: requested,
    tier_executed: tierExecuted,
    tiers_run: tiersRun,
    blocked
  };
}
