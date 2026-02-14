import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import type { PersonalityProfile } from "../types.js";
import type { ResolveOptions } from "./types.js";

export function loadProfileFile(filePath: string): PersonalityProfile {
  const raw = fs.readFileSync(filePath, "utf8");
  return parseYaml(raw) as PersonalityProfile;
}

export function resolveParentPath(
  profilePath: string,
  extendsName: string,
  options: ResolveOptions = {}
): string | null {
  const localCandidate = path.join(path.dirname(profilePath), `${extendsName}.yaml`);
  if (fs.existsSync(localCandidate)) return localCandidate;

  const bundledDir =
    options.bundledProfilesDir ?? path.resolve(path.dirname(profilePath), "..");
  const bundledCandidate = path.join(bundledDir, `${extendsName}.yaml`);
  if (fs.existsSync(bundledCandidate)) return bundledCandidate;

  return null;
}
