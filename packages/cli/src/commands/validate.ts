import path from "node:path";

import { validateProfile } from "@traits-dev/core";
import {
  formatValidationResult,
  toValidationResultObject
} from "@traits-dev/core/internal";
import type { CommandIO, OutputWriter } from "../types.js";
import type { ValidationDiagnostic, ValidationResult } from "@traits-dev/core";

type ValidateFormat = "text" | "json" | "sarif";

type ValidateArgs = {
  profilePath: string | null;
  strict: boolean;
  json: boolean;
  format: ValidateFormat;
  verbose: boolean;
  noColor: boolean;
  bundledProfilesDir: string | null;
};

type ParsedValidateArgs =
  | { error: string }
  | {
      value: ValidateArgs;
    };

function printValidateUsage(out: OutputWriter = process.stderr): void {
  out.write(
    [
      "Usage:",
      "  traits validate <profile-path> [options]",
      "",
      "Options:",
      "  --json                   Output structured JSON",
      "  --format <text|json|sarif> Output format (default: text)",
      "  --strict                 Promote warnings to errors",
      "  --verbose                Include additional command metadata",
      "  --no-color               Disable colorized output",
      "  --bundled-profiles-dir   Directory for bundled starter profiles",
      ""
    ].join("\n")
  );
}

function parseValidateArgs(args: string[]): ParsedValidateArgs {
  const result: ValidateArgs = {
    profilePath: null,
    strict: false,
    json: false,
    format: "text",
    verbose: false,
    noColor: false,
    bundledProfilesDir: null
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
      result.format = "json";
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
    if (arg === "--bundled-profiles-dir") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { error: 'Missing value for "--bundled-profiles-dir"' };
      }
      result.bundledProfilesDir = nextValue;
      index += 1;
      continue;
    }
    if (arg === "--format") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { error: 'Missing value for "--format"' };
      }
      const normalized = String(nextValue).toLowerCase();
      if (normalized !== "text" && normalized !== "json" && normalized !== "sarif") {
        return { error: 'Invalid "--format" value. Expected text, json, or sarif.' };
      }
      result.format = normalized as ValidateFormat;
      result.json = normalized === "json";
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
  return { value: result };
}

function toRelativePath(cwd: string, filePath: string): string {
  const relative = path.relative(cwd, filePath);
  if (relative && !relative.startsWith("..")) return relative;
  return filePath;
}

function buildSarifReport(
  validation: ValidationResult,
  profilePath: string,
  cwd: string
): Record<string, unknown> {
  const diagnostics = [...validation.errors, ...validation.warnings];
  const uniqueRuleIds = [...new Set(diagnostics.map((diagnostic) => diagnostic.code))];
  const artifactUri = toRelativePath(cwd, profilePath);

  const rules = uniqueRuleIds.map((ruleId) => ({
    id: ruleId,
    shortDescription: {
      text: `traits.dev ${ruleId}`
    }
  }));

  const results = diagnostics.map((diagnostic: ValidationDiagnostic) => ({
    ruleId: diagnostic.code,
    level: diagnostic.severity === "error" ? "error" : "warning",
    message: {
      text: diagnostic.message
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: artifactUri
          }
        }
      }
    ]
  }));

  return {
    version: "2.1.0",
    $schema:
      "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "traits.dev",
            informationUri: "https://github.com/justinhambleton/traits",
            rules
          }
        },
        results
      }
    ]
  };
}

export function runValidate(args: string[], io: CommandIO = process): number {
  const parsed = parseValidateArgs(args);
  if ("error" in parsed) {
    io.stderr.write(`Error: ${parsed.error}\n\n`);
    printValidateUsage(io.stderr);
    return 1;
  }

  const options = parsed.value;
  if (!options.profilePath) {
    io.stderr.write("Error: Missing profile path\n\n");
    printValidateUsage(io.stderr);
    return 1;
  }

  const bundledProfilesDir = options.bundledProfilesDir
    ? path.resolve(io.cwd(), options.bundledProfilesDir)
    : path.resolve(io.cwd(), "profiles");
  const profilePath = path.resolve(io.cwd(), options.profilePath);
  const result = validateProfile(profilePath, {
    strict: options.strict,
    bundledProfilesDir
  });

  if (options.format === "json") {
    io.stdout.write(`${JSON.stringify(toValidationResultObject(result), null, 2)}\n`);
  } else if (options.format === "sarif") {
    const sarif = buildSarifReport(result, profilePath, io.cwd());
    io.stdout.write(`${JSON.stringify(sarif, null, 2)}\n`);
  } else {
    if (options.verbose) {
      io.stdout.write(`Profile path: ${profilePath}\n`);
      io.stdout.write(`Bundled profiles dir: ${bundledProfilesDir}\n`);
      io.stdout.write(`Strict mode: ${options.strict ? "on" : "off"}\n\n`);
    }
    io.stdout.write(`${formatValidationResult(result)}\n`);
  }

  return result.exitCode;
}

export function validateHelp(out: OutputWriter = process.stdout): void {
  printValidateUsage(out);
}
