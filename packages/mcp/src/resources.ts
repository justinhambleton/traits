import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { compileResolvedProfile } from "@traits-dev/core";
import type { PersonalityProfile } from "@traits-dev/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getProfilesDir(): string {
  // Resolve relative to the package root (works for both dist/ and src/)
  const dir = path.resolve(__dirname, "..", "profiles");
  if (fs.existsSync(dir)) return dir;
  throw new Error(`Cannot find profiles directory at ${dir}. Run 'pnpm build' to copy starter profiles.`);
}

export interface BundledProfile {
  name: string;
  filename: string;
  yamlContent: string;
  profile: PersonalityProfile;
}

export function listBundledProfiles(): BundledProfile[] {
  const dir = getProfilesDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort();
  return files.map((filename) => {
    const yamlContent = fs.readFileSync(path.join(dir, filename), "utf-8");
    const profile = parseYaml(yamlContent) as PersonalityProfile;
    const name = filename.replace(/\.yaml$/, "");
    return { name, filename, yamlContent, profile };
  });
}

export function registerResources(server: McpServer): void {
  // Static resource: list all profiles
  server.registerResource(
    "profiles-list",
    "traits://profiles",
    {
      title: "Traits Starter Profiles",
      description: "List of available traits voice profiles.",
      mimeType: "application/json"
    },
    async () => {
      const profiles = listBundledProfiles();
      const list = profiles.map((p) => ({
        name: p.name,
        description: p.profile.meta.description,
        version: p.profile.meta.version
      }));
      return {
        contents: [{
          uri: "traits://profiles",
          mimeType: "application/json",
          text: JSON.stringify(list, null, 2)
        }]
      };
    }
  );

  // Template resource: read a specific profile's YAML source
  server.registerResource(
    "profile-yaml",
    new ResourceTemplate("traits://profiles/{name}", { list: undefined }),
    {
      title: "Profile YAML Source",
      description: "Read a specific starter profile's YAML source.",
      mimeType: "text/yaml"
    },
    async (uri, { name }) => {
      const profiles = listBundledProfiles();
      const found = profiles.find((p) => p.name === name);
      if (!found) {
        throw new Error(`Profile not found: ${name}`);
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/yaml",
          text: found.yamlContent
        }]
      };
    }
  );

  // Template resource: read a profile's compiled personality text with model target
  server.registerResource(
    "profile-compiled",
    new ResourceTemplate("traits://profiles/{name}/compiled/{model}", { list: undefined }),
    {
      title: "Compiled Profile",
      description: "Read a profile's compiled personality text for a specific model.",
      mimeType: "text/plain"
    },
    async (uri, { name, model }) => {
      const profiles = listBundledProfiles();
      const found = profiles.find((p) => p.name === name);
      if (!found) {
        throw new Error(`Profile not found: ${name}`);
      }
      const modelStr = Array.isArray(model) ? model[0] : model;
      const compiled = compileResolvedProfile(found.profile, { model: modelStr ?? "unknown" });
      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/plain",
          text: compiled.text
        }]
      };
    }
  );
}
