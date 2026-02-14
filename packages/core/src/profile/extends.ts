import { loadProfileFile, resolveParentPath } from "./load.js";
import { mergeProfiles } from "./merge.js";
import type { ExtendsDiagnostics, ExtendsResult } from "../types.js";
import type { ResolveOptions } from "./types.js";

export function resolveExtends(
  profilePath: string,
  options: ResolveOptions = {}
): ExtendsResult {
  const diagnostics: ExtendsDiagnostics = { warnings: [], errors: [] };
  const childProfile = loadProfileFile(profilePath);

  if (!childProfile?.extends) {
    return {
      profile: childProfile,
      parentPath: null,
      diagnostics
    };
  }

  const parentPath = resolveParentPath(profilePath, childProfile.extends, options);
  if (!parentPath) {
    diagnostics.errors.push({
      code: "E_RESOLVE_EXTENDS",
      severity: "error",
      message: `Unable to resolve parent profile "${childProfile.extends}".`
    });
    return { profile: childProfile, parentPath: null, diagnostics };
  }

  const parentProfile = loadProfileFile(parentPath);
  if (parentProfile?.extends) {
    diagnostics.errors.push({
      code: "E_EXTENDS_CHAIN",
      severity: "error",
      message: "extends chains are not supported in MVP."
    });
    return { profile: childProfile, parentPath, diagnostics };
  }

  const merged = mergeProfiles(parentProfile, childProfile);
  delete merged.extends;
  return { profile: merged, parentPath, diagnostics };
}
