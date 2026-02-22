import path from "node:path";

import { diffProfiles, loadProfileFile, resolveExtends } from "@traits-dev/core";
import type { CommandIO, OutputWriter } from "../types.js";
import type { ProfileDiff, DiffEntry, PersonalityProfile } from "@traits-dev/core";

type DiffArgs = {
  profilePathA: string | null;
  profilePathB: string | null;
  resolved: boolean;
  json: boolean;
  bundledProfilesDir: string | null;
};

type ParsedDiffArgs = { error: string } | { value: DiffArgs };

function printDiffUsage(out: OutputWriter = process.stderr): void {
  out.write(
    [
      "Usage:",
      "  traits diff <profile-a> <profile-b> [options]",
      "  traits diff <profile> --resolved [options]",
      "",
      "Options:",
      "  --resolved               Compare profile before and after extends resolution",
      "  --json                   Output structured JSON",
      "  --bundled-profiles-dir   Directory for bundled starter profiles",
      ""
    ].join("\n")
  );
}

function parseDiffArgs(args: string[]): ParsedDiffArgs {
  const result: DiffArgs = {
    profilePathA: null,
    profilePathB: null,
    resolved: false,
    json: false,
    bundledProfilesDir: null
  };

  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--resolved") {
      result.resolved = true;
      continue;
    }
    if (arg === "--json") {
      result.json = true;
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

  if (result.resolved) {
    if (positionals.length !== 1) {
      return { error: "Expected exactly one profile path with --resolved" };
    }
    result.profilePathA = positionals[0];
  } else {
    if (positionals.length !== 2) {
      return { error: "Expected two profile path arguments (or one with --resolved)" };
    }
    result.profilePathA = positionals[0];
    result.profilePathB = positionals[1];
  }

  return { value: result };
}

function formatDiffEntry(entry: DiffEntry): string {
  const prefix = entry.type === "added" ? "+" : entry.type === "removed" ? "-" : "~";
  if (entry.type === "added") {
    const val = typeof entry.newValue === "string" ? `"${entry.newValue}"` : JSON.stringify(entry.newValue);
    return `  ${prefix} ${entry.path}: ${val}`;
  }
  if (entry.type === "removed") {
    const val = typeof entry.oldValue === "string" ? `"${entry.oldValue}"` : JSON.stringify(entry.oldValue);
    return `  ${prefix} ${entry.path}: ${val}`;
  }
  const oldVal = typeof entry.oldValue === "string" ? entry.oldValue : JSON.stringify(entry.oldValue);
  const newVal = typeof entry.newValue === "string" ? entry.newValue : JSON.stringify(entry.newValue);
  return `  ${prefix} ${entry.path}: ${oldVal} -> ${newVal}`;
}

function formatDiffText(diff: ProfileDiff, nameA: string, nameB: string): string {
  const lines: string[] = [];
  lines.push(`traits diff: ${nameA} vs ${nameB}`);
  lines.push("");

  if (diff.changes.length === 0) {
    lines.push("  No differences found.");
  } else {
    for (const entry of diff.changes) {
      lines.push(formatDiffEntry(entry));
    }
  }

  lines.push("");
  lines.push(`Summary: ${diff.summary.added} added, ${diff.summary.removed} removed, ${diff.summary.modified} modified`);
  return lines.join("\n");
}

function loadAndResolve(
  profilePath: string,
  bundledProfilesDir: string
): PersonalityProfile {
  const result = resolveExtends(profilePath, { bundledProfilesDir });
  if (result.diagnostics.errors.length > 0) {
    const msg = result.diagnostics.errors.map((e) => e.message).join("; ");
    throw new Error(`Failed to resolve profile: ${msg}`);
  }
  return result.profile;
}

export function runDiff(args: string[], io: CommandIO = process): number {
  const parsed = parseDiffArgs(args);
  if ("error" in parsed) {
    io.stderr.write(`Error: ${parsed.error}\n\n`);
    printDiffUsage(io.stderr);
    return 1;
  }

  const options = parsed.value;
  const bundledProfilesDir = options.bundledProfilesDir
    ? path.resolve(io.cwd(), options.bundledProfilesDir)
    : path.resolve(io.cwd(), "profiles");

  try {
    let profileA: PersonalityProfile;
    let profileB: PersonalityProfile;
    let nameA: string;
    let nameB: string;

    if (options.resolved) {
      const profilePath = path.resolve(io.cwd(), options.profilePathA!);
      const raw = loadProfileFile(profilePath);
      const resolved = loadAndResolve(profilePath, bundledProfilesDir);
      profileA = raw;
      profileB = resolved;
      nameA = `${path.basename(profilePath)} (raw)`;
      nameB = `${path.basename(profilePath)} (resolved)`;
    } else {
      const pathA = path.resolve(io.cwd(), options.profilePathA!);
      const pathB = path.resolve(io.cwd(), options.profilePathB!);
      profileA = loadAndResolve(pathA, bundledProfilesDir);
      profileB = loadAndResolve(pathB, bundledProfilesDir);
      nameA = path.basename(pathA);
      nameB = path.basename(pathB);
    }

    const diff = diffProfiles(profileA, profileB);

    if (options.json) {
      io.stdout.write(`${JSON.stringify({ nameA, nameB, ...diff }, null, 2)}\n`);
    } else {
      io.stdout.write(`${formatDiffText(diff, nameA, nameB)}\n`);
    }

    return diff.changes.length > 0 ? 1 : 0;
  } catch (error) {
    io.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

export function diffHelp(out: OutputWriter = process.stdout): void {
  printDiffUsage(out);
}
