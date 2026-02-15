import { loadProfileFile, resolveParentPath } from "./load.js";
import { mergeProfiles } from "./merge.js";
import type { ExtendsDiagnostics, ExtendsResult } from "../types.js";
import type { ResolveOptions } from "./types.js";
import type { PersonalityProfile } from "../types.js";

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

export function resolveExtends(
  profilePath: string,
  options: ResolveOptions = {}
): ExtendsResult {
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

    const parentProfile = loadProfileFile(parentPath);
    if (parentProfile?.extends) {
      diagnostics.errors.push({
        code: "E_EXTENDS_CHAIN",
        severity: "error",
        message: "extends chains are not supported in MVP."
      });
      return {
        profile: childProfile,
        parentPath: parentPaths[0] ?? parentPath,
        parentPaths: [...parentPaths, parentPath],
        parentProfile: null,
        diagnostics
      };
    }

    parentPaths.push(parentPath);
    mergedParent = mergedParent
      ? mergeProfiles(mergedParent, parentProfile)
      : parentProfile;
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
