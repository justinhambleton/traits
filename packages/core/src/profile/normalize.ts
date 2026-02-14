import type { PersonalityProfile } from "../types.js";
import { resolveExtends } from "./extends.js";
import type { ResolveOptions } from "./types.js";

export function normalizeProfile(
  profilePath: string,
  options: ResolveOptions = {}
): PersonalityProfile {
  return resolveExtends(profilePath, options).profile;
}
