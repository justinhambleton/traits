import { z } from "zod";
import { parse as parseYaml } from "yaml";
import {
  validateResolvedProfile,
  compileResolvedProfile
} from "@traits-dev/core";
import type { PersonalityProfile } from "@traits-dev/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listBundledProfiles } from "./resources.js";

export function registerTools(server: McpServer): void {
  server.registerTool("traits_validate", {
    title: "Validate Profile",
    description: "Validate a traits voice profile YAML against the schema and safety checks.",
    inputSchema: z.object({
      yaml: z.string().describe("Profile YAML content"),
      strict: z.boolean().optional().describe("Treat warnings as errors")
    })
  }, async ({ yaml, strict }) => {
    try {
      const profile = parseYaml(yaml) as PersonalityProfile;
      const result = validateResolvedProfile(profile, { strict: strict ?? false });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.isValid
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `YAML parse error: ${(err as Error).message}` }],
        isError: true
      };
    }
  });

  server.registerTool("traits_compile", {
    title: "Compile Profile",
    description: "Compile a traits voice profile YAML into a personality prompt text.",
    inputSchema: z.object({
      yaml: z.string().describe("Profile YAML content"),
      model: z.string().optional().describe("Target model (e.g. 'claude', 'gpt-4o')"),
      context: z.record(z.unknown()).optional().describe("Context variables for context_adaptations")
    })
  }, async ({ yaml, model, context }) => {
    try {
      const profile = parseYaml(yaml) as PersonalityProfile;
      const compiled = compileResolvedProfile(profile, {
        model: model ?? "unknown",
        context: context ?? {}
      });
      return {
        content: [{ type: "text", text: compiled.text }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Compilation error: ${(err as Error).message}` }],
        isError: true
      };
    }
  });

  server.registerTool("traits_list_profiles", {
    title: "List Profiles",
    description: "List available starter profiles with metadata."
  }, async () => {
    const profiles = listBundledProfiles();
    const summary = profiles.map((p) => ({
      name: p.name,
      description: p.profile.meta.description,
      version: p.profile.meta.version,
      schema: p.profile.schema,
      role: p.profile.identity.role
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
    };
  });
}
