import fs from "node:fs";
import path from "node:path";

import { loadProfileFile, validateResolvedProfile } from "@traits-dev/core";
import { renderImportedProfileYAML, toValidationResultObject } from "@traits-dev/core/internal";
import type { PersonalityProfile } from "@traits-dev/core";
import type { CommandIO, OutputWriter } from "../types.js";

type SourceSchema = "v1.4" | "v1.5";
type TargetSchema = "v1.5" | "v1.6";

const SCHEMA_ORDER: Record<SourceSchema | TargetSchema, number> = {
  "v1.4": 0,
  "v1.5": 1,
  "v1.6": 2
};

type MigrateArgs = {
  profilePath: string | null;
  to: TargetSchema;
  outputPath: string | null;
  inPlace: boolean;
  force: boolean;
  normalizeExtends: boolean;
  json: boolean;
  verbose: boolean;
  noColor: boolean;
};

type ParsedMigrateArgs =
  | { error: string }
  | {
      value: MigrateArgs;
    };

function printMigrateUsage(out: OutputWriter = process.stderr): void {
  out.write(
    [
      "Usage:",
      "  traits migrate <profile-path> [options]",
      "",
      "Options:",
      "  --to <version>            Target schema version (default: v1.6; supported: v1.5, v1.6)",
      "  --output <path>           Output file path (default: <name>.<target>.yaml)",
      "  --in-place                Overwrite the source file (requires --force if file exists)",
      "  --force                   Overwrite existing destination file",
      "  --normalize-extends       Convert single-string extends to array form (v1.6 target only)",
      "  --json                    Output structured JSON summary",
      "  --verbose                 Include additional command metadata",
      "  --no-color                Disable colorized output",
      ""
    ].join("\n")
  );
}

function parseMigrateArgs(args: string[]): ParsedMigrateArgs {
  const result: MigrateArgs = {
    profilePath: null,
    to: "v1.6",
    outputPath: null,
    inPlace: false,
    force: false,
    normalizeExtends: false,
    json: false,
    verbose: false,
    noColor: false
  };

  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--in-place") {
      result.inPlace = true;
      continue;
    }
    if (arg === "--force") {
      result.force = true;
      continue;
    }
    if (arg === "--normalize-extends") {
      result.normalizeExtends = true;
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
    if (arg === "--to" || arg === "--output") {
      const value = args[index + 1];
      if (!value) return { error: `Missing value for "${arg}"` };
      if (arg === "--to") {
        if (value !== "v1.5" && value !== "v1.6") {
          return {
            error: `Unsupported "--to" value "${value}". Currently supported: v1.5, v1.6`
          };
        }
        result.to = value;
      } else {
        result.outputPath = value;
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

  if (result.inPlace && result.outputPath) {
    return { error: 'Use either "--in-place" or "--output", not both.' };
  }

  if (result.normalizeExtends && result.to !== "v1.6") {
    return { error: '"--normalize-extends" requires "--to v1.6".' };
  }

  return { value: result };
}

function resolveDefaultOutputPath(sourcePath: string, toVersion: string): string {
  const ext = path.extname(sourcePath) || ".yaml";
  const base = sourcePath.slice(0, sourcePath.length - ext.length);
  return `${base}.${toVersion}${ext}`;
}

function writeFileAtomic(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempFile = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );
  fs.writeFileSync(tempFile, contents, "utf8");
  fs.renameSync(tempFile, filePath);
}

function migrateV14ToV15(profile: PersonalityProfile): { migrated: PersonalityProfile; capabilitiesAdded: boolean } {
  const migrated = JSON.parse(JSON.stringify(profile)) as PersonalityProfile;
  migrated.schema = "v1.5";
  if (!migrated.capabilities) {
    migrated.capabilities = {
      tools: [],
      constraints: [],
      handoff: {
        trigger: "Request requires unavailable operations.",
        action: "Offer handoff to a human operator."
      }
    };
    return { migrated, capabilitiesAdded: true };
  }
  return { migrated, capabilitiesAdded: false };
}

function migrateV15ToV16(
  profile: PersonalityProfile,
  options: { normalizeExtends: boolean }
): { migrated: PersonalityProfile; extendsNormalized: boolean } {
  const migrated = JSON.parse(JSON.stringify(profile)) as PersonalityProfile;
  migrated.schema = "v1.6";

  if (options.normalizeExtends && typeof migrated.extends === "string") {
    const normalized = migrated.extends.trim();
    if (normalized.length > 0) {
      migrated.extends = [normalized];
      return { migrated, extendsNormalized: true };
    }
  }

  return { migrated, extendsNormalized: false };
}

function asSupportedSourceSchema(value: unknown): SourceSchema | null {
  if (value === "v1.4" || value === "v1.5") return value;
  return null;
}

export function runMigrate(args: string[], io: CommandIO = process): number {
  const parsed = parseMigrateArgs(args);
  if ("error" in parsed) {
    io.stderr.write(`Error: ${parsed.error}\n\n`);
    printMigrateUsage(io.stderr);
    return 1;
  }

  const options = parsed.value;
  if (!options.profilePath) {
    io.stderr.write("Error: Missing profile path\n\n");
    printMigrateUsage(io.stderr);
    return 1;
  }

  const sourcePath = path.resolve(io.cwd(), options.profilePath);
  const destinationPath = options.inPlace
    ? sourcePath
    : options.outputPath
      ? path.resolve(io.cwd(), options.outputPath)
      : resolveDefaultOutputPath(sourcePath, options.to);

  if (!fs.existsSync(sourcePath)) {
    io.stderr.write(`Error: Source profile does not exist: ${sourcePath}\n`);
    return 1;
  }

  if (fs.existsSync(destinationPath) && !options.force) {
    io.stderr.write(
      `Error: Destination file already exists: ${destinationPath}. Use --force to overwrite.\n`
    );
    return 1;
  }

  let loaded: PersonalityProfile;
  try {
    loaded = loadProfileFile(sourcePath);
  } catch (error) {
    io.stderr.write(
      `Error: Failed to read profile: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return 1;
  }

  if (loaded.schema === "v1.6") {
    io.stderr.write(
      'Error: Source profile is already at "v1.6". Nothing to migrate.\n'
    );
    return 1;
  }

  const sourceSchema = asSupportedSourceSchema(loaded.schema);
  if (!sourceSchema) {
    io.stderr.write(
      `Error: Migration source schema must be "v1.4" or "v1.5". Found "${loaded.schema ?? "unknown"}".\n`
    );
    return 1;
  }

  if (SCHEMA_ORDER[options.to] < SCHEMA_ORDER[sourceSchema]) {
    io.stderr.write(
      `Error: Downgrade is not supported (source "${sourceSchema}" -> target "${options.to}").\n`
    );
    return 1;
  }

  if (SCHEMA_ORDER[options.to] === SCHEMA_ORDER[sourceSchema]) {
    io.stderr.write(`Error: Source profile already uses target schema "${options.to}".\n`);
    return 1;
  }

  let migrated = loaded;
  let capabilitiesAdded = false;
  let extendsNormalized = false;
  let currentSchema: SourceSchema | "v1.6" = sourceSchema;

  if (currentSchema === "v1.4") {
    const step = migrateV14ToV15(migrated);
    migrated = step.migrated;
    capabilitiesAdded = step.capabilitiesAdded;
    currentSchema = "v1.5";
  }

  if (options.to === "v1.6" && currentSchema === "v1.5") {
    const step = migrateV15ToV16(migrated, {
      normalizeExtends: options.normalizeExtends
    });
    migrated = step.migrated;
    extendsNormalized = step.extendsNormalized;
    currentSchema = "v1.6";
  }

  if (currentSchema !== options.to) {
    io.stderr.write(
      `Error: Failed to migrate profile to target schema "${options.to}". Final schema: "${currentSchema}".\n`
    );
    return 2;
  }

  const validation = validateResolvedProfile(migrated, {
    strict: false
  });
  if (validation.errors.length > 0) {
    io.stderr.write(
      `Error: Migrated profile is invalid and was not written (${validation.errors.length} error(s)).\n`
    );
    return 2;
  }

  const yaml = renderImportedProfileYAML(migrated);
  writeFileAtomic(destinationPath, yaml);

  if (options.json) {
    io.stdout.write(
      `${JSON.stringify(
        {
          migrated: true,
          sourcePath,
          outputPath: destinationPath,
          fromSchema: sourceSchema,
          toSchema: options.to,
          capabilitiesAdded,
          extendsNormalized,
          validation: toValidationResultObject(validation)
        },
        null,
        2
      )}\n`
    );
    return 0;
  }

  if (options.verbose) {
    io.stdout.write(`Source: ${sourcePath}\n`);
    io.stdout.write(`Output: ${destinationPath}\n`);
    io.stdout.write(`Capabilities added: ${capabilitiesAdded ? "yes" : "no"}\n`);
    io.stdout.write(`Extends normalized: ${extendsNormalized ? "yes" : "no"}\n`);
    io.stdout.write(`Validation warnings: ${validation.warnings.length}\n\n`);
  }

  io.stdout.write(`Migrated profile schema ${sourceSchema} -> ${options.to}\n`);
  io.stdout.write(`Wrote: ${destinationPath}\n`);
  return 0;
}

export function migrateHelp(out: OutputWriter = process.stdout): void {
  printMigrateUsage(out);
}
