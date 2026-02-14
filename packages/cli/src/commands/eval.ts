import fs from "node:fs";
import path from "node:path";

import {
  detectEvalTierAvailability,
  formatValidationResult,
  resolveTierExecution,
  runOfflineBaselineScaffold,
  runTier1EvaluationForProfile,
  runTier2EvaluationForProfile,
  runTier3EvaluationForProfile,
  toValidationResultObject
} from "@traits-dev/core";
import type { CommandIO, OutputWriter } from "../types.js";

type EvalProvider = "auto" | "openai" | "anthropic";

type EvalSample = {
  id?: string;
  prompt?: string;
  response?: string;
};

type EvalArgs = {
  profilePath: string | null;
  model: string | null;
  tier: number | null;
  provider: EvalProvider;
  embeddingModel: string | null;
  judgeModel: string | null;
  openaiBaseUrl: string | null;
  anthropicBaseUrl: string | null;
  timeoutMs: number | null;
  maxRetries: number | null;
  retryBaseMs: number | null;
  json: boolean;
  strict: boolean;
  verbose: boolean;
  noColor: boolean;
  responses: string[];
  samplesPath: string | null;
  noBaselines: boolean;
  noHelpfulness: boolean;
  constraintImpact: boolean;
};

type ParsedEvalArgs =
  | { error: string }
  | {
      value: EvalArgs;
    };

type Tier1Report = ReturnType<typeof runTier1EvaluationForProfile>["report"];
type Tier2Report = Awaited<ReturnType<typeof runTier2EvaluationForProfile>>["report"];
type Tier3Report = Awaited<ReturnType<typeof runTier3EvaluationForProfile>>["report"];

type TierReports = {
  tier1?: Tier1Report;
  tier2?: Tier2Report;
  tier3?: Tier3Report;
};

function printEvalUsage(out: OutputWriter = process.stderr): void {
  out.write(
    [
      "Usage:",
      "  traits eval <profile-path> --model <model> [options]",
      "",
      "Options:",
      "  --model <model>           Model target (required)",
      "  --tier <1|2|3>            Highest tier to run (default: highest available)",
      "  --provider <name>         Judge provider for Tier 3: auto|openai|anthropic",
      "  --embedding-model <name>  Embedding model for Tier 2 (OpenAI)",
      "  --judge-model <name>      Judge model for Tier 3 provider",
      "  --openai-base-url <url>   Override OpenAI API base URL",
      "  --anthropic-base-url <url> Override Anthropic API base URL",
      "  --timeout-ms <ms>         Provider request timeout (default: 20000)",
      "  --max-retries <count>     Provider retry attempts (default: 2)",
      "  --retry-base-ms <ms>      Base backoff delay (default: 250)",
      "  --response <text>         Assistant response sample (repeatable)",
      "  --samples <path>          JSON file with samples: [{ id, response }]",
      "  --scenarios <path>        Alias for --samples in this scaffold",
      "  --json                    Output structured JSON",
      "  --strict                  Treat validation warnings as errors",
      "  --verbose                 Include command metadata output",
      "  --no-color                Disable colorized output",
      "  --no-baselines            Skip offline baseline scaffold comparison",
      "  --no-helpfulness          Skip helpfulness checks in scoring",
      "  --constraint-impact       Reserved flag (accepted, no-op in scaffold)",
      ""
    ].join("\n")
  );
}

function parseEvalArgs(args: string[]): ParsedEvalArgs {
  const result: EvalArgs = {
    profilePath: null,
    model: null,
    tier: null,
    provider: "auto",
    embeddingModel: null,
    judgeModel: null,
    openaiBaseUrl: null,
    anthropicBaseUrl: null,
    timeoutMs: null,
    maxRetries: null,
    retryBaseMs: null,
    json: false,
    strict: false,
    verbose: false,
    noColor: false,
    responses: [],
    samplesPath: null,
    noBaselines: false,
    noHelpfulness: false,
    constraintImpact: false
  };

  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      result.json = true;
      continue;
    }
    if (arg === "--strict") {
      result.strict = true;
      continue;
    }
    if (arg === "--verbose") {
      result.verbose = true;
      continue;
    }
    if (arg === "--no-color") {
      result.noColor = true;
      continue;
    }
    if (arg === "--no-baselines") {
      result.noBaselines = true;
      continue;
    }
    if (arg === "--no-helpfulness") {
      result.noHelpfulness = true;
      continue;
    }
    if (arg === "--constraint-impact") {
      result.constraintImpact = true;
      continue;
    }

    if (
      arg === "--model" ||
      arg === "--tier" ||
      arg === "--provider" ||
      arg === "--embedding-model" ||
      arg === "--judge-model" ||
      arg === "--openai-base-url" ||
      arg === "--anthropic-base-url" ||
      arg === "--timeout-ms" ||
      arg === "--max-retries" ||
      arg === "--retry-base-ms" ||
      arg === "--response" ||
      arg === "--samples" ||
      arg === "--scenarios"
    ) {
      const value = args[index + 1];
      if (!value) return { error: `Missing value for "${arg}"` };
      if (arg === "--model") result.model = value;
      if (arg === "--tier") result.tier = Number(value);
      if (arg === "--provider") {
        result.provider = String(value).toLowerCase() as EvalProvider;
      }
      if (arg === "--embedding-model") result.embeddingModel = value;
      if (arg === "--judge-model") result.judgeModel = value;
      if (arg === "--openai-base-url") result.openaiBaseUrl = value;
      if (arg === "--anthropic-base-url") result.anthropicBaseUrl = value;
      if (arg === "--timeout-ms") result.timeoutMs = Number(value);
      if (arg === "--max-retries") result.maxRetries = Number(value);
      if (arg === "--retry-base-ms") result.retryBaseMs = Number(value);
      if (arg === "--response") result.responses.push(value);
      if (arg === "--samples" || arg === "--scenarios") result.samplesPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return { error: `Unknown option "${arg}"` };
    }
    positionals.push(arg);
  }

  if (positionals.length !== 1) {
    return { error: "Expected exactly one profile path argument" };
  }
  result.profilePath = positionals[0];

  if (!result.model) {
    return { error: 'Missing required option "--model"' };
  }
  if (result.tier != null && ![1, 2, 3].includes(result.tier)) {
    return { error: 'Invalid "--tier" value. Expected 1, 2, or 3.' };
  }
  if (!(["auto", "openai", "anthropic"] as const).includes(result.provider)) {
    return { error: 'Invalid "--provider" value. Expected auto, openai, or anthropic.' };
  }
  if (result.timeoutMs != null && (!Number.isInteger(result.timeoutMs) || result.timeoutMs < 0)) {
    return { error: 'Invalid "--timeout-ms" value. Expected a non-negative integer.' };
  }
  if (
    result.maxRetries != null &&
    (!Number.isInteger(result.maxRetries) || result.maxRetries < 0)
  ) {
    return { error: 'Invalid "--max-retries" value. Expected a non-negative integer.' };
  }
  if (
    result.retryBaseMs != null &&
    (!Number.isInteger(result.retryBaseMs) || result.retryBaseMs < 0)
  ) {
    return { error: 'Invalid "--retry-base-ms" value. Expected a non-negative integer.' };
  }

  return { value: result };
}

function loadSamples(options: EvalArgs, cwd: string): EvalSample[] {
  if (options.samplesPath) {
    const sampleFile = path.resolve(cwd, options.samplesPath);
    const parsed = JSON.parse(fs.readFileSync(sampleFile, "utf8")) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Sample file must be a JSON array");
    }
    return parsed.map((item, index) => {
      if (typeof item === "string") {
        return { id: `sample-${index + 1}`, response: item };
      }
      if (!item || typeof item !== "object") {
        return { id: `sample-${index + 1}`, response: "" };
      }

      const sample = item as Record<string, unknown>;
      return {
        id: sample.id != null ? String(sample.id) : `sample-${index + 1}`,
        response: String(sample.response ?? ""),
        prompt: sample.prompt != null ? String(sample.prompt) : undefined
      };
    });
  }

  return options.responses.map((response, index) => ({
    id: `sample-${index + 1}`,
    response
  }));
}

function writeProgress(io: CommandIO, options: EvalArgs, message: string): void {
  if (options.json) return;
  io.stderr.write(`${message}\n`);
}

type CommandError = {
  code?: string;
  message?: string;
  validation?: unknown;
};

export async function runEval(args: string[], io: CommandIO = process): Promise<number> {
  const parsed = parseEvalArgs(args);
  if ("error" in parsed) {
    io.stderr.write(`Error: ${parsed.error}\n\n`);
    printEvalUsage(io.stderr);
    return 1;
  }

  const options = parsed.value;
  if (!options.profilePath || !options.model) {
    io.stderr.write("Error: Missing required arguments\n\n");
    printEvalUsage(io.stderr);
    return 1;
  }

  const profilePath = path.resolve(io.cwd(), options.profilePath);
  const bundledProfilesDir = path.resolve(io.cwd(), "profiles");

  let samples: EvalSample[];
  try {
    samples = loadSamples(options, io.cwd());
  } catch (error) {
    io.stderr.write(
      `Error loading samples: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return 1;
  }
  if (samples.length === 0) {
    io.stderr.write("Error: Provide at least one --response or a --samples file.\n");
    return 1;
  }

  if (options.verbose) {
    io.stderr.write(`Eval profile: ${profilePath}\n`);
    io.stderr.write(`Model: ${options.model}\n`);
    io.stderr.write(
      `Requested tier: ${options.tier != null ? options.tier : "auto-highest"}\n`
    );
    io.stderr.write(`Provider preference: ${options.provider}\n`);
    if (options.embeddingModel) {
      io.stderr.write(`Embedding model: ${options.embeddingModel}\n`);
    }
    if (options.judgeModel) {
      io.stderr.write(`Judge model: ${options.judgeModel}\n`);
    }
  }

  const availability = detectEvalTierAvailability(process.env, {
    provider: options.provider
  });
  const autoRequestedTier =
    [3, 2, 1].find(
      (tier) => availability?.[tier]?.available && availability?.[tier]?.implemented
    ) ?? 1;
  const requestedTier = options.tier ?? autoRequestedTier;
  const tierResolution = resolveTierExecution(requestedTier, availability);
  if (tierResolution.blocked.length > 0 && !options.json) {
    for (const blocked of tierResolution.blocked) {
      io.stderr.write(`Tier ${blocked.tier} unavailable: ${blocked.reason}\n`);
    }
  }

  try {
    const tierReports: TierReports = {};
    let baselineReport: ReturnType<typeof runOfflineBaselineScaffold> | null = null;

    let evaluation: ReturnType<typeof runTier1EvaluationForProfile> | null = null;
    if (tierResolution.tiers_run.includes(1)) {
      writeProgress(io, options, "Running Tier 1 checks...");
      evaluation = runTier1EvaluationForProfile(profilePath, samples, {
        strict: options.strict,
        bundledProfilesDir,
        includeHelpfulness: !options.noHelpfulness
      });
      tierReports.tier1 = evaluation.report;
      writeProgress(io, options, "Tier 1 complete.");
    }

    if (tierResolution.tiers_run.includes(2)) {
      writeProgress(io, options, "Running Tier 2 checks...");
      const tier2 = await runTier2EvaluationForProfile(profilePath, samples, {
        strict: options.strict,
        bundledProfilesDir,
        openaiApiKey: process.env.TRAITS_OPENAI_API_KEY,
        embeddingModel: options.embeddingModel ?? undefined,
        openaiBaseUrl: options.openaiBaseUrl ?? undefined,
        includeHelpfulness: !options.noHelpfulness,
        fetchTimeoutMs: options.timeoutMs ?? undefined,
        fetchMaxRetries: options.maxRetries ?? undefined,
        fetchRetryBaseMs: options.retryBaseMs ?? undefined
      });
      tierReports.tier2 = tier2.report;
      writeProgress(io, options, "Tier 2 complete.");
    }

    if (tierResolution.tiers_run.includes(3)) {
      writeProgress(io, options, "Running Tier 3 checks...");
      const tier3 = await runTier3EvaluationForProfile(profilePath, samples, {
        strict: options.strict,
        bundledProfilesDir,
        provider: options.provider,
        judgeModel: options.judgeModel ?? undefined,
        openaiApiKey: process.env.TRAITS_OPENAI_API_KEY,
        anthropicApiKey: process.env.TRAITS_ANTHROPIC_API_KEY,
        openaiBaseUrl: options.openaiBaseUrl ?? undefined,
        anthropicBaseUrl: options.anthropicBaseUrl ?? undefined,
        includeHelpfulness: !options.noHelpfulness,
        fetchTimeoutMs: options.timeoutMs ?? undefined,
        fetchMaxRetries: options.maxRetries ?? undefined,
        fetchRetryBaseMs: options.retryBaseMs ?? undefined
      });
      tierReports.tier3 = tier3.report;
      writeProgress(io, options, "Tier 3 complete.");
    }

    if (!options.noBaselines && evaluation?.validation?.profile) {
      writeProgress(io, options, "Running offline baseline scaffold...");
      baselineReport = runOfflineBaselineScaffold(evaluation.validation.profile, samples, {
        includeHelpfulness: !options.noHelpfulness,
        compiledTier1Report: tierReports.tier1
      });
      writeProgress(io, options, "Offline baseline scaffold complete.");
    }

    const allScores = [
      tierReports.tier1?.average_score,
      tierReports.tier2?.average_score,
      tierReports.tier3?.average_score
    ].filter((score): score is number => Number.isFinite(score));

    const overallScore =
      allScores.length > 0
        ? allScores.reduce((sum, value) => sum + value, 0) / allScores.length
        : 0;

    const payload: Record<string, unknown> = {
      profile: profilePath,
      model: options.model,
      tier_requested: requestedTier,
      tier_executed: tierResolution.tier_executed,
      tier_resolution: tierResolution,
      tier_availability: availability,
      report: {
        overall_score: overallScore,
        ...tierReports,
        ...(baselineReport ? { baselines: baselineReport } : {})
      }
    };

    if (evaluation?.validation) {
      payload.validation = {
        warnings: evaluation.validation.warnings.length,
        errors: evaluation.validation.errors.length
      };
    }

    if (options.json) {
      io.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return 0;
    }

    if (tierReports.tier1) {
      io.stdout.write(`Tier 1 average score: ${tierReports.tier1.average_score.toFixed(3)}\n`);
      for (const sample of tierReports.tier1.samples) {
        io.stdout.write(`- ${sample.id}: ${sample.score.toFixed(3)}\n`);
      }
    }
    if (tierReports.tier2) {
      io.stdout.write(`Tier 2 average score: ${tierReports.tier2.average_score.toFixed(3)}\n`);
    }
    if (tierReports.tier3) {
      io.stdout.write(`Tier 3 average score: ${tierReports.tier3.average_score.toFixed(3)}\n`);
    }
    if (baselineReport?.tier1) {
      io.stdout.write(
        `Baseline (none) Tier 1 avg: ${baselineReport.tier1.none.average_score.toFixed(3)}\n`
      );
      io.stdout.write(
        `Baseline (basic) Tier 1 avg: ${baselineReport.tier1.basic.average_score.toFixed(3)}\n`
      );
      const deltas = baselineReport.tier1.deltas ?? {};
      const compiledVsNone = deltas.compiled_vs_none;
      if (typeof compiledVsNone === "number" && Number.isFinite(compiledVsNone)) {
        io.stdout.write(`Delta vs none baseline: ${compiledVsNone.toFixed(3)}\n`);
      }
      const compiledVsBasic = deltas.compiled_vs_basic;
      if (typeof compiledVsBasic === "number" && Number.isFinite(compiledVsBasic)) {
        io.stdout.write(`Delta vs basic baseline: ${compiledVsBasic.toFixed(3)}\n`);
      }
    }
    io.stdout.write(`Overall eval score: ${overallScore.toFixed(3)}\n`);
    return 0;
  } catch (error) {
    const typedError = error as CommandError;

    if (
      (typedError.code === "E_EVAL_TIER2_UNAVAILABLE" ||
        typedError.code === "E_EVAL_TIER3_UNAVAILABLE") &&
      !options.json
    ) {
      io.stderr.write(`Error: ${typedError.message ?? "Evaluation tier unavailable."}\n`);
      return 2;
    }

    if (
      (typedError.code === "E_EVAL_TIER2_UNAVAILABLE" ||
        typedError.code === "E_EVAL_TIER3_UNAVAILABLE") &&
      options.json
    ) {
      io.stdout.write(
        `${JSON.stringify(
          {
            error: typedError.message,
            code: typedError.code
          },
          null,
          2
        )}\n`
      );
      return 2;
    }

    const validation = typedError.validation as
      | Parameters<typeof formatValidationResult>[0]
      | undefined;

    if (typedError.code === "E_EVAL_VALIDATION" && validation) {
      if (options.json) {
        io.stdout.write(
          `${JSON.stringify(
            {
              error: typedError.message,
              code: typedError.code,
              validation: toValidationResultObject(validation)
            },
            null,
            2
          )}\n`
        );
      } else {
        io.stderr.write(`${formatValidationResult(validation)}\n`);
      }
      return (
        (validation as {
          exitCode?: number;
        }).exitCode ?? 2
      );
    }

    io.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

export function evalHelp(out: OutputWriter = process.stdout): void {
  printEvalUsage(out);
}
