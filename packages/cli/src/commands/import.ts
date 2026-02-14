import fs from "node:fs";
import path from "node:path";

import {
  formatValidationResult,
  runImportAnalysis,
  toValidationResultObject,
  validateResolvedProfile
} from "@traits-dev/core";
import type { CommandIO, OutputWriter } from "../types.js";

type ImportProvider = "auto" | "openai" | "anthropic";

type ImportArgs = {
  promptPath: string | null;
  provider: ImportProvider;
  model: string | null;
  profileName: string | null;
  outputPath: string | null;
  openaiBaseUrl: string | null;
  anthropicBaseUrl: string | null;
  timeoutMs: number | null;
  maxRetries: number | null;
  retryBaseMs: number | null;
  strict: boolean;
  json: boolean;
  verbose: boolean;
  noColor: boolean;
};

type ParsedImportArgs =
  | { error: string }
  | {
      value: ImportArgs;
    };

type PromptSource = {
  source: string;
  text: string;
};

type CommandError = {
  code?: string;
  message?: string;
};

function printImportUsage(out: OutputWriter = process.stderr): void {
  out.write(
    [
      "Usage:",
      "  traits import [prompt-path] [options]",
      "",
      "Options:",
      "  --provider <name>         Import provider: auto|openai|anthropic (default: auto)",
      "  --model <model>           Import analysis model override",
      "  --name <profile-name>     Output profile meta.name override",
      "  --output <path>           Write generated YAML profile to file",
      "  --openai-base-url <url>   Override OpenAI API base URL",
      "  --anthropic-base-url <url> Override Anthropic API base URL",
      "  --timeout-ms <ms>         Provider request timeout (default: 20000)",
      "  --max-retries <count>     Provider retry attempts (default: 2)",
      "  --retry-base-ms <ms>      Base backoff delay (default: 250)",
      "  --strict                  Treat validation warnings as errors",
      "  --json                    Output structured JSON",
      "  --verbose                 Include command metadata output",
      "  --no-color                Disable colorized output",
      "",
      "Input:",
      "  prompt-path               Existing system prompt text file",
      "  (stdin)                   Pipe prompt text when prompt-path is omitted",
      ""
    ].join("\n")
  );
}

function parseImportArgs(args: string[]): ParsedImportArgs {
  const result: ImportArgs = {
    promptPath: null,
    provider: "auto",
    model: null,
    profileName: null,
    outputPath: null,
    openaiBaseUrl: null,
    anthropicBaseUrl: null,
    timeoutMs: null,
    maxRetries: null,
    retryBaseMs: null,
    strict: false,
    json: false,
    verbose: false,
    noColor: false
  };

  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--strict") {
      result.strict = true;
      continue;
    }
    if (arg === "--json") {
      result.json = true;
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

    if (
      arg === "--provider" ||
      arg === "--model" ||
      arg === "--name" ||
      arg === "--output" ||
      arg === "--openai-base-url" ||
      arg === "--anthropic-base-url" ||
      arg === "--timeout-ms" ||
      arg === "--max-retries" ||
      arg === "--retry-base-ms"
    ) {
      const value = args[index + 1];
      if (!value) return { error: `Missing value for "${arg}"` };
      if (arg === "--provider") result.provider = String(value).toLowerCase() as ImportProvider;
      if (arg === "--model") result.model = value;
      if (arg === "--name") result.profileName = value;
      if (arg === "--output") result.outputPath = value;
      if (arg === "--openai-base-url") result.openaiBaseUrl = value;
      if (arg === "--anthropic-base-url") result.anthropicBaseUrl = value;
      if (arg === "--timeout-ms") result.timeoutMs = Number(value);
      if (arg === "--max-retries") result.maxRetries = Number(value);
      if (arg === "--retry-base-ms") result.retryBaseMs = Number(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      return { error: `Unknown option "${arg}"` };
    }

    positionals.push(arg);
  }

  if (positionals.length > 1) {
    return { error: "Expected zero or one prompt path argument" };
  }
  result.promptPath = positionals[0] ?? null;

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

async function readStream(stream: AsyncIterable<unknown>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8"));
  }
  return chunks.join("");
}

async function loadPromptSource(options: ImportArgs, io: CommandIO): Promise<PromptSource> {
  if (options.promptPath) {
    const promptPath = path.resolve(io.cwd(), options.promptPath);
    return {
      source: promptPath,
      text: fs.readFileSync(promptPath, "utf8")
    };
  }

  const stdin = io.stdin ?? process.stdin;
  if (stdin.isTTY) {
    throw new Error("Provide a prompt file path or pipe prompt text via stdin.");
  }

  return {
    source: "stdin",
    text: await readStream(stdin)
  };
}

export async function runImport(args: string[], io: CommandIO = process): Promise<number> {
  const parsed = parseImportArgs(args);
  if ("error" in parsed) {
    io.stderr.write(`Error: ${parsed.error}\n\n`);
    printImportUsage(io.stderr);
    return 1;
  }

  const options = parsed.value;
  let promptSource: PromptSource;
  try {
    promptSource = await loadPromptSource(options, io);
  } catch (error) {
    io.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  const promptText = String(promptSource.text ?? "").trim();
  if (!promptText) {
    io.stderr.write("Error: Prompt source is empty.\n");
    return 1;
  }

  if (options.verbose) {
    io.stderr.write(`Import source: ${promptSource.source}\n`);
    io.stderr.write(`Provider preference: ${options.provider}\n`);
    if (options.model) {
      io.stderr.write(`Model override: ${options.model}\n`);
    }
  }

  try {
    const imported = await runImportAnalysis(promptText, {
      provider: options.provider,
      model: options.model ?? undefined,
      profileName: options.profileName ?? undefined,
      openaiApiKey: process.env.TRAITS_OPENAI_API_KEY,
      anthropicApiKey: process.env.TRAITS_ANTHROPIC_API_KEY,
      openaiBaseUrl: options.openaiBaseUrl ?? undefined,
      anthropicBaseUrl: options.anthropicBaseUrl ?? undefined,
      fetchTimeoutMs: options.timeoutMs ?? undefined,
      fetchMaxRetries: options.maxRetries ?? undefined,
      fetchRetryBaseMs: options.retryBaseMs ?? undefined
    });

    const validation = validateResolvedProfile(imported.profile, {
      strict: options.strict
    });
    const outputPath = options.outputPath
      ? path.resolve(io.cwd(), options.outputPath)
      : null;

    if (outputPath) {
      fs.writeFileSync(outputPath, imported.yaml, "utf8");
    }

    if (options.json) {
      io.stdout.write(
        `${JSON.stringify(
          {
            provider: imported.provider,
            source: promptSource.source,
            output_path: outputPath,
            profile: imported.profile,
            analysis: imported.analysis,
            validation: toValidationResultObject(validation),
            yaml: outputPath ? undefined : imported.yaml
          },
          null,
          2
        )}\n`
      );
      return validation.exitCode ?? 0;
    }

    if (!outputPath) {
      io.stdout.write(`${imported.yaml.trimEnd()}\n`);
    } else {
      io.stdout.write(`Wrote imported profile to ${outputPath}\n`);
    }

    io.stderr.write(`\n[Validation]\n${formatValidationResult(validation)}\n`);
    io.stderr.write("\nNext: run `traits eval <profile-path> --model <model>` to verify fit.\n");
    return validation.exitCode ?? 0;
  } catch (error) {
    const typedError = error as CommandError;
    if (typedError.code === "E_IMPORT_PROVIDER_UNAVAILABLE") {
      if (options.json) {
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
      } else {
        io.stderr.write(`Error: ${typedError.message ?? "Import provider unavailable."}\n`);
      }
      return 2;
    }

    io.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

export function importHelp(out: OutputWriter = process.stdout): void {
  printImportUsage(out);
}
