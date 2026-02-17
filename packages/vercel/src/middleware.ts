import type { LanguageModelV3CallOptions, LanguageModelV3Middleware } from "@ai-sdk/provider";
import {
  compileProfile,
  compileResolvedProfile,
  injectPersonality
} from "@traits-dev/core";
import type {
  CompileOptions,
  CompiledPersonality,
  PersonalityProfile
} from "@traits-dev/core";

export type WithPersonalityOptions = {
  model?: string;
  context?: Record<string, unknown>;
  strict?: boolean;
  bundledProfilesDir?: string;
  knowledgeBaseDir?: string;
};

function detectModel(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.includes("claude")) return "claude";
  if (id.includes("gpt") || id.includes("o1") || id.includes("o3") || id.includes("o4")) return "gpt";
  return modelId;
}

export function createPersonalityMiddleware(
  compiled: CompiledPersonality
): LanguageModelV3Middleware {
  return {
    specificationVersion: "v3",
    transformParams: async ({ params }) => {
      const prompt = params.prompt;
      const systemIndex = prompt.findIndex((m) => m.role === "system");

      if (systemIndex >= 0) {
        const existing = prompt[systemIndex];
        if (existing.role === "system") {
          const merged = injectPersonality({
            compiledPersonality: compiled,
            system: existing.content,
            model: compiled.placement.model
          });
          const updated = [...prompt];
          updated[systemIndex] = { ...existing, content: merged };
          return { ...params, prompt: updated } satisfies LanguageModelV3CallOptions;
        }
      }

      return {
        ...params,
        prompt: [
          { role: "system" as const, content: compiled.text },
          ...prompt
        ]
      } satisfies LanguageModelV3CallOptions;
    }
  };
}

export function compileEagerly(
  profile: string | PersonalityProfile,
  modelId: string,
  options?: WithPersonalityOptions
): CompiledPersonality {
  const compileOpts: CompileOptions = {
    model: options?.model ?? detectModel(modelId),
    context: options?.context,
    strict: options?.strict,
    bundledProfilesDir: options?.bundledProfilesDir,
    knowledgeBaseDir: options?.knowledgeBaseDir
  };

  if (typeof profile === "string") {
    return compileProfile(profile, compileOpts);
  }

  return compileResolvedProfile(profile, compileOpts);
}
