import path from "node:path";

import {
  compileProfile,
  formatValidationResult,
  toValidationResultObject
} from "@traits-dev/core";

function printCompileUsage(out = process.stderr) {
  out.write(
    [
      "Usage:",
      "  traits compile <profile-path> --model <model> [options]",
      "",
      "Options:",
      "  --model <model>           Model target (required)",
      "  --json                    Output structured JSON",
      "  --strict                  Treat warnings as compile-blocking",
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

function parseContextArg(value) {
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

function parseCompileArgs(args) {
  const result = {
    profilePath: null,
    model: null,
    strict: false,
    json: false,
    explain: false,
    verbose: false,
    noColor: false,
    knowledgeBaseDir: null,
    bundledProfilesDir: null,
    context: {}
  };

  const positionals = [];
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
      arg === "--knowledge-base-dir"
    ) {
      const value = args[index + 1];
      if (!value) return { error: `Missing value for "${arg}"` };
      if (arg === "--model") {
        result.model = value;
      } else if (arg === "--bundled-profiles-dir") {
        result.bundledProfilesDir = value;
      } else if (arg === "--knowledge-base-dir") {
        result.knowledgeBaseDir = value;
      } else {
        const parsedContext = parseContextArg(value);
        if (parsedContext.error) return { error: parsedContext.error };
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

  return { value: result };
}

export function runCompile(args, io = process) {
  const parsed = parseCompileArgs(args);
  if (parsed.error) {
    io.stderr.write(`Error: ${parsed.error}\n\n`);
    printCompileUsage(io.stderr);
    return 1;
  }

  const options = parsed.value;
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
      return 0;
    }

    io.stdout.write(`${compiled.text}\n`);
    if (options.explain && compiled.trace) {
      io.stdout.write(`\n[TRACE]\n${JSON.stringify(compiled.trace, null, 2)}\n`);
    }
    return 0;
  } catch (error) {
    if (error?.code === "E_COMPILE_VALIDATION" && error.validation) {
      if (options.json) {
        io.stdout.write(
          `${JSON.stringify(
            {
              error: error.message,
              code: error.code,
              validation: toValidationResultObject(error.validation)
            },
            null,
            2
          )}\n`
        );
      } else {
        io.stderr.write(`${formatValidationResult(error.validation)}\n`);
      }
      return error.validation.exitCode ?? 2;
    }

    io.stderr.write(
      `Error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return 2;
  }
}

export function compileHelp(out = process.stdout) {
  printCompileUsage(out);
}
