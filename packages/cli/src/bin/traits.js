#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileHelp, runCompile } from "../commands/compile.js";
import { evalHelp, runEval } from "../commands/eval.js";
import { initHelp, runInit } from "../commands/init.js";
import { importHelp, runImport } from "../commands/import.js";
import { runValidate, validateHelp } from "../commands/validate.js";

const PACKAGE_JSON_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../package.json"
);

function printRootUsage(out = process.stdout) {
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
      "  eval <profile-path>       Evaluate profile responses (Tier 1 scaffold)",
      "  import [prompt-path]      Import a profile from an existing system prompt",
      "  validate <profile-path>   Validate a personality profile",
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

function readCliVersion() {
  try {
    const raw = fs.readFileSync(PACKAGE_JSON_PATH, "utf8");
    const pkg = JSON.parse(raw);
    return String(pkg.version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function parseGlobalFlags(args) {
  const flags = { json: false, verbose: false, noColor: false };
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

function withGlobalFlags(command, commandArgs, flags) {
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
      command === "eval" ||
      command === "import") &&
    flags.json &&
    !args.includes("--json")
  ) {
    args.push("--json");
  }
  return args;
}

async function run(argv, io = process) {
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
  if (parsed.error) {
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

  io.stderr.write(`Error: Unknown command "${command}"\n\n`);
  printRootUsage(io.stderr);
  return 1;
}

const code = await run(process.argv.slice(2), process);
process.exitCode = code;

export { run };
