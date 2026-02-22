import path from "node:path";
import { loadProfileFile, resolveParentPath } from "./load.js";
import { mergeProfiles } from "./merge.js";
import type { ExtendsDiagnostics, ExtendsResult, PersonalityProfile } from "../types.js";
import type { ResolveOptions } from "./types.js";

const DEFAULT_MAX_EXTENDS_DEPTH = 5;

function normalizeExtendsTargets(value: unknown): string[] | null {
  if (value == null) return [];
  if (typeof value === "string") {
    return value.trim().length > 0 ? [value] : null;
  }
  if (!Array.isArray(value) || value.length === 0) return null;

  const targets: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      return null;
    }
    targets.push(item);
  }
  return targets;
}

function errorResult(
  code: string,
  message: string,
  profile: PersonalityProfile,
  parentPaths: string[]
): ExtendsResult {
  return {
    profile,
    parentPath: parentPaths[0] ?? null,
    parentPaths,
    parentProfile: null,
    diagnostics: {
      warnings: [],
      errors: [{ code, severity: "error", message }]
    }
  };
}

function resolveExtendsRecursive(
  profilePath: string,
  options: ResolveOptions,
  visited: Set<string>,
  depth: number,
  maxDepth: number
): ExtendsResult {
  const normalizedPath = path.resolve(profilePath);

  if (visited.has(normalizedPath)) {
    const chain = [...visited, normalizedPath].join(" → ");
    const stub = { schema: "v1.6", meta: { name: "cycle-stub", version: "0.0.0", description: "" }, identity: { role: "" }, voice: {} } as PersonalityProfile;
    return errorResult("E_EXTENDS_CYCLE", `Circular extends detected: ${chain}`, stub, []);
  }

  if (depth >= maxDepth) {
    const stub = { schema: "v1.6", meta: { name: "depth-stub", version: "0.0.0", description: "" }, identity: { role: "" }, voice: {} } as PersonalityProfile;
    return errorResult("E_EXTENDS_DEPTH", `Extends chain exceeds maximum depth (${maxDepth}).`, stub, []);
  }

  const diagnostics: ExtendsDiagnostics = { warnings: [], errors: [] };
  const childProfile = loadProfileFile(profilePath);
  const extendsTargets = normalizeExtendsTargets(childProfile?.extends);

  if (!extendsTargets || extendsTargets.length === 0) {
    return {
      profile: childProfile,
      parentPath: null,
      parentPaths: [],
      parentProfile: null,
      diagnostics
    };
  }

  visited.add(normalizedPath);

  const parentPaths: string[] = [];
  let mergedParent: PersonalityProfile | null = null;

  for (const extendsName of extendsTargets) {
    const parentPath = resolveParentPath(profilePath, extendsName, options);
    if (!parentPath) {
      diagnostics.errors.push({
        code: "E_RESOLVE_EXTENDS",
        severity: "error",
        message: `Unable to resolve parent profile "${extendsName}".`
      });
      return {
        profile: childProfile,
        parentPath: parentPaths[0] ?? null,
        parentPaths,
        parentProfile: null,
        diagnostics
      };
    }

    // Recursively resolve the parent
    const parentResult = resolveExtendsRecursive(
      parentPath,
      options,
      new Set(visited),
      depth + 1,
      maxDepth
    );

    if (parentResult.diagnostics.errors.length > 0) {
      return {
        profile: childProfile,
        parentPath: parentPaths[0] ?? parentPath,
        parentPaths: [...parentPaths, parentPath],
        parentProfile: null,
        diagnostics: parentResult.diagnostics
      };
    }

    parentPaths.push(parentPath);
    mergedParent = mergedParent
      ? mergeProfiles(mergedParent, parentResult.profile)
      : parentResult.profile;
  }

  const parentProfile = mergedParent;
  if (!parentProfile) {
    return {
      profile: childProfile,
      parentPath: null,
      parentPaths: [],
      parentProfile: null,
      diagnostics
    };
  }

  const merged = mergeProfiles(parentProfile, childProfile);
  delete merged.extends;
  return {
    profile: merged,
    parentPath: parentPaths[0] ?? null,
    parentPaths,
    parentProfile,
    diagnostics
  };
}

export function resolveExtends(
  profilePath: string,
  options: ResolveOptions & { maxExtendsDepth?: number } = {}
): ExtendsResult {
  const maxDepth = options.maxExtendsDepth ?? DEFAULT_MAX_EXTENDS_DEPTH;
  return resolveExtendsRecursive(profilePath, options, new Set(), 0, maxDepth);
}
