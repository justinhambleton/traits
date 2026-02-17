import type { LanguageModelV3 } from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";
import type { PersonalityProfile } from "@traits-dev/core";
import { compileEagerly, createPersonalityMiddleware } from "./middleware.js";
import type { WithPersonalityOptions } from "./middleware.js";

export { compileEagerly, createPersonalityMiddleware } from "./middleware.js";
export type { WithPersonalityOptions } from "./middleware.js";

/**
 * Wrap a Vercel AI SDK language model with a traits personality profile.
 *
 * The profile is compiled eagerly — if the profile path is invalid or fails
 * validation, this function throws immediately.
 *
 * @param model - A Vercel AI SDK LanguageModelV3 instance
 * @param profile - A file path to a traits YAML profile, or a pre-loaded PersonalityProfile object
 * @param options - Compilation options (model override, context, strict mode, etc.)
 * @returns A wrapped LanguageModelV3 that automatically injects the personality
 */
export function withPersonality(
  model: LanguageModelV3,
  profile: string | PersonalityProfile,
  options?: WithPersonalityOptions
): LanguageModelV3 {
  const compiled = compileEagerly(profile, model.modelId, options);
  const middleware = createPersonalityMiddleware(compiled);
  return wrapLanguageModel({ model, middleware });
}
