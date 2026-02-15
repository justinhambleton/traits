import path from "node:path";

import { compileProfile } from "@traits-dev/core";
import {
  formatValidationResult,
  toValidationResultObject
} from "@traits-dev/core/internal";
import type { CommandIO, OutputWriter } from "../types.js";

type ContextValue = boolean | string;

type CompileArgs = {
  profilePath: string | null;
  model: string | null;
  strict: boolean;
  json: boolean;
  budget: boolean;
  budgetLimit: number | null;
  explain: boolean;
  verbose: boolean;
  noColor: boolean;
  knowledgeBaseDir: string | null;
  bundledProfilesDir: string | null;
  context: Record<string, ContextValue>;
};

type ParsedCompileArgs =
  | { error: string }
  | {
      value: CompileArgs;
    };

type ParsedContextArg =
  | { error: string }
  | {
      key: string;
      value: ContextValue;
    };

function printCompileUsage(out: OutputWriter = process.stderr): void {
  out.write(
    [
      "Usage:",
      "  traits compile <profile-path> --model <model> [options]",
      "",
      "Options:",
      "  --model <model>           Model target (required)",
      "  --json                    Output structured JSON",
      "  --strict                  Treat warnings as compile-blocking",
      "  --budget                  Print estimated token count (chars/4)",
      "  --budget-limit <tokens>   Warn to stderr if estimate exceeds limit",
      "  --explain                 Include compilation trace output",
      "  --context key=value       Activate context adaptation (repeatable)",
      "  --knowledge-base-dir      Directory containing compiler pattern files",
      "  --bundled-profiles-dir    Directory for bundled starter profiles",
      "  --verbose                 Include additional command metadata",
      "  --no-color                Disable colorized output",
      ""
    ].join("\n")
  );
}

function parseContextArg(value: string): ParsedContextArg {
  const [key, rawValue] = String(value).split("=", 2);
  const normalizedKey = String(key).trim();
  if (!normalizedKey) return { error: `Invalid context value "${value}"` };
  if (rawValue == null) return { key: normalizedKey, value: true };

  const normalizedValue = String(rawValue).trim().toLowerCase();
  if (normalizedValue === "true" || normalizedValue === "1") {
    return { key: normalizedKey, value: true };
  }
  if (normalizedValue === "false" || normalizedValue === "0") {
    return { key: normalizedKey, value: false };
  }
  return { key: normalizedKey, value: rawValue };
}

function parseCompileArgs(args: string[]): ParsedCompileArgs {
  const result: CompileArgs = {
    profilePath: null,
    model: null,
    strict: false,
    json: false,
    budget: false,
    budgetLimit: null,
    explain: false,
    verbose: false,
    noColor: false,
    knowledgeBaseDir: null,
    bundledProfilesDir: null,
    context: {}
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
    if (arg === "--budget") {
      result.budget = true;
      continue;
    }
    if (arg === "--explain") {
      result.explain = true;
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
      arg === "--model" ||
      arg === "--bundled-profiles-dir" ||
      arg === "--context" ||
      arg === "--knowledge-base-dir" ||
      arg === "--budget-limit"
    ) {
      const value = args[index + 1];
      if (!value) return { error: `Missing value for "${arg}"` };
      if (arg === "--model") {
        result.model = value;
      } else if (arg === "--bundled-profiles-dir") {
        result.bundledProfilesDir = value;
      } else if (arg === "--knowledge-base-dir") {
        result.knowledgeBaseDir = value;
      } else if (arg === "--budget-limit") {
        const parsedBudgetLimit = Number(value);
        if (!Number.isFinite(parsedBudgetLimit) || parsedBudgetLimit <= 0) {
          return { error: `Invalid value for "--budget-limit": "${value}"` };
        }
        result.budgetLimit = Math.round(parsedBudgetLimit);
      } else {
        const parsedContext = parseContextArg(value);
        if ("error" in parsedContext) return { error: parsedContext.error };
        result.context[parsedContext.key] = parsedContext.value;
      }
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

  if (result.budgetLimit != null) {
    result.budget = true;
  }

  return { value: result };
}

function estimateBudgetTokens(text: string): number {
  return Math.ceil(String(text ?? "").length / 4);
}

export function runCompile(args: string[], io: CommandIO = process): number {
  const parsed = parseCompileArgs(args);
  if ("error" in parsed) {
    io.stderr.write(`Error: ${parsed.error}\n\n`);
    printCompileUsage(io.stderr);
    return 1;
  }

  const options = parsed.value;
  if (!options.profilePath || !options.model) {
    io.stderr.write("Error: Missing required arguments\n\n");
    printCompileUsage(io.stderr);
    return 1;
  }

  const profilePath = path.resolve(io.cwd(), options.profilePath);
  const bundledProfilesDir = options.bundledProfilesDir
    ? path.resolve(io.cwd(), options.bundledProfilesDir)
    : path.resolve(io.cwd(), "profiles");
  const knowledgeBaseDir = options.knowledgeBaseDir
    ? path.resolve(io.cwd(), options.knowledgeBaseDir)
    : path.resolve(io.cwd(), "knowledge-base");

  if (options.verbose) {
    io.stderr.write(`Compiling: ${profilePath}\n`);
    io.stderr.write(`Model: ${options.model}\n`);
    io.stderr.write(`Strict mode: ${options.strict ? "on" : "off"}\n`);
  }

  try {
    const compiled = compileProfile(profilePath, {
      model: options.model,
      strict: options.strict,
      explain: options.explain,
      context: options.context,
      bundledProfilesDir,
      knowledgeBaseDir
    });

    const warningCount = compiled.validation?.warnings?.length ?? 0;
    if (warningCount > 0 && !options.json) {
      io.stderr.write(`Validation warnings: ${warningCount}\n`);
    }

    if (options.json) {
      io.stdout.write(`${JSON.stringify(compiled, null, 2)}\n`);
      if (options.budget) {
        const budgetEstimate = estimateBudgetTokens(compiled.text);
        io.stderr.write(`Estimated token count: ${budgetEstimate}\n`);
        if (options.budgetLimit != null && budgetEstimate > options.budgetLimit) {
          io.stderr.write(
            `Warning: Estimated token count ${budgetEstimate} exceeds budget limit ${options.budgetLimit}\n`
          );
        }
      }
      return 0;
    }

    io.stdout.write(`${compiled.text}\n`);
    if (options.budget) {
      const budgetEstimate = estimateBudgetTokens(compiled.text);
      io.stderr.write(`Estimated token count: ${budgetEstimate}\n`);
      if (options.budgetLimit != null && budgetEstimate > options.budgetLimit) {
        io.stderr.write(
          `Warning: Estimated token count ${budgetEstimate} exceeds budget limit ${options.budgetLimit}\n`
        );
      }
    }
    if (options.explain && compiled.trace) {
      io.stdout.write(`\n[TRACE]\n${JSON.stringify(compiled.trace, null, 2)}\n`);
    }
    return 0;
  } catch (error) {
    const typedError = error as {
      code?: string;
      message?: string;
      validation?: {
        exitCode?: number;
      };
    };

    if (typedError.code === "E_COMPILE_VALIDATION" && typedError.validation) {
      if (options.json) {
        io.stdout.write(
          `${JSON.stringify(
            {
              error: typedError.message,
              code: typedError.code,
              validation: toValidationResultObject(typedError.validation)
            },
            null,
            2
          )}\n`
        );
      } else {
        io.stderr.write(`${formatValidationResult(typedError.validation)}\n`);
      }
      return typedError.validation.exitCode ?? 2;
    }

    io.stderr.write(
      `Error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return 2;
  }
}

export function compileHelp(out: OutputWriter = process.stdout): void {
  printCompileUsage(out);
}
