#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileHelp, runCompile } from "../commands/compile.js";
import { diffHelp, runDiff } from "../commands/diff.js";
import { evalHelp, runEval } from "../commands/eval.js";
import { initHelp, runInit } from "../commands/init.js";
import { importHelp, runImport } from "../commands/import.js";
import { migrateHelp, runMigrate } from "../commands/migrate.js";
import { runValidate, validateHelp } from "../commands/validate.js";
import type { CommandIO, OutputWriter } from "../types.js";

const CLI_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_CANDIDATES = [
  path.resolve(CLI_DIR, "../package.json"),
  path.resolve(CLI_DIR, "../../package.json")
];

function resolvePackageJsonPath(): string {
  for (const candidate of PACKAGE_JSON_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return PACKAGE_JSON_CANDIDATES[0];
}

const PACKAGE_JSON_PATH = resolvePackageJsonPath();

type GlobalFlags = {
  json: boolean;
  verbose: boolean;
  noColor: boolean;
};

type ParsedGlobalFlags =
  | { error: string }
  | {
      flags: GlobalFlags;
      command: string | null;
      commandArgs: string[];
    };

function printRootUsage(out: OutputWriter = process.stdout): void {
  out.write(
    [
      "traits.dev CLI",
      "",
      "Usage:",
      "  traits [global-options] <command> [options]",
      "",
      "Commands:",
      "  init [output-path]        Create a profile scaffold",
      "  compile <profile-path>    Compile a profile for a target model",
      "  diff <a> <b>              Compare two profiles structurally",
      "  eval <profile-path>       Evaluate profile responses (Tier 1 scaffold)",
      "  import [prompt-path]      Import a profile from an existing system prompt",
      "  migrate <profile-path>    Migrate profile schema (up to v1.6)",
      "  validate <profile-path>   Validate a voice profile",
      "",
      "Global flags:",
      "  --json                    Output JSON where supported",
      "  --verbose                 Print command metadata",
      "  --no-color                Disable colorized output",
      "  --version                 Show CLI version",
      "  --help, -h                Show help",
      "",
      "Examples:",
      "  traits init my-profile.yaml --domain customer-support --tone warm",
      "  traits validate profiles/resolve.yaml",
      "  traits --json validate profiles/haven.yaml --strict",
      ""
    ].join("\n")
  );
}

function readCliVersion(): string {
  try {
    const raw = fs.readFileSync(PACKAGE_JSON_PATH, "utf8");
    const pkg = JSON.parse(raw) as {
      version?: string;
    };
    return String(pkg.version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function parseGlobalFlags(args: string[]): ParsedGlobalFlags {
  const flags: GlobalFlags = { json: false, verbose: false, noColor: false };
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg === "--json") {
      flags.json = true;
      index += 1;
      continue;
    }
    if (arg === "--verbose") {
      flags.verbose = true;
      index += 1;
      continue;
    }
    if (arg === "--no-color") {
      flags.noColor = true;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      return { error: `Unknown global option "${arg}"` };
    }
    break;
  }

  return {
    flags,
    command: args[index] ?? null,
    commandArgs: args.slice(index + 1)
  };
}

function withGlobalFlags(command: string, commandArgs: string[], flags: GlobalFlags): string[] {
  const args = [...commandArgs];
  if (flags.verbose && !args.includes("--verbose")) {
    args.push("--verbose");
  }
  if (flags.noColor && !args.includes("--no-color")) {
    args.push("--no-color");
  }
  if (
    (command === "validate" ||
      command === "compile" ||
      command === "diff" ||
      command === "eval" ||
      command === "import" ||
      command === "migrate") &&
    flags.json &&
    !args.includes("--json")
  ) {
    args.push("--json");
  }
  return args;
}

async function run(argv: string[], io: CommandIO = process): Promise<number> {
  const args = [...argv];

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printRootUsage(io.stdout);
    return 0;
  }
  if (args[0] === "--version") {
    io.stdout.write(`${readCliVersion()}\n`);
    return 0;
  }

  const parsed = parseGlobalFlags(args);
  if ("error" in parsed) {
    io.stderr.write(`Error: ${parsed.error}\n\n`);
    printRootUsage(io.stderr);
    return 1;
  }

  const command = parsed.command;
  if (!command) {
    io.stderr.write("Error: Missing command\n\n");
    printRootUsage(io.stderr);
    return 1;
  }

  const commandArgs = withGlobalFlags(command, parsed.commandArgs, parsed.flags);

  if (command === "validate") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      validateHelp(io.stdout);
      return 0;
    }
    return runValidate(commandArgs, io);
  }

  if (command === "init") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      initHelp(io.stdout);
      return 0;
    }
    return runInit(commandArgs, io);
  }

  if (command === "compile") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      compileHelp(io.stdout);
      return 0;
    }
    return runCompile(commandArgs, io);
  }

  if (command === "diff") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      diffHelp(io.stdout);
      return 0;
    }
    return runDiff(commandArgs, io);
  }

  if (command === "eval") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      evalHelp(io.stdout);
      return 0;
    }
    return runEval(commandArgs, io);
  }

  if (command === "import") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      importHelp(io.stdout);
      return 0;
    }
    return runImport(commandArgs, io);
  }

  if (command === "migrate") {
    if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
      migrateHelp(io.stdout);
      return 0;
    }
    return runMigrate(commandArgs, io);
  }

  io.stderr.write(`Error: Unknown command "${command}"\n\n`);
  printRootUsage(io.stderr);
  return 1;
}

const code = await run(process.argv.slice(2), process);
process.exitCode = code;

export { run };
