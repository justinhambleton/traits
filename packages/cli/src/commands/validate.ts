import path from "node:path";

import {
  formatValidationResult,
  toValidationResultObject,
  validateProfile
} from "@traits-dev/core";
import type { CommandIO, OutputWriter } from "../types.js";

type ValidateArgs = {
  profilePath: string | null;
  strict: boolean;
  json: boolean;
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
      "  traits validate <profile-path> [--json] [--strict] [--bundled-profiles-dir <dir>]",
      "",
      "Options:",
      "  --json                   Output structured JSON",
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

  if (options.json) {
    io.stdout.write(`${JSON.stringify(toValidationResultObject(result), null, 2)}\n`);
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
