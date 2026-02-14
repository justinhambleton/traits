import { detectToolsSection } from "./detect-sections.js";
import { isClaudeModel, isGptModel } from "../utils.js";
import type { CompiledPersonality } from "../types.js";

type Placement = "start" | "after_tools" | "end";
type CompiledLike = string | Pick<CompiledPersonality, "text" | "placement">;

function defaultPlacement(model: unknown): Placement {
  if (isClaudeModel(model)) return "start";
  if (isGptModel(model)) return "after_tools";
  return "start";
}

function splitLines(text: string): string[] {
  return String(text ?? "").split("\n");
}

function concatSections(parts: string[]): string {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter((part) => part.length > 0)
    .join("\n\n");
}

function extractCompiledText(compiledPersonality: CompiledLike): {
  text: string;
  placement: Placement | null;
} {
  if (typeof compiledPersonality === "string") {
    return {
      text: compiledPersonality,
      placement: null
    };
  }

  return {
    text: String(compiledPersonality?.text ?? ""),
    placement: compiledPersonality?.placement?.recommended_position ?? null
  };
}

export function injectPersonality({
  compiledPersonality,
  system = "",
  model = ""
}: {
  compiledPersonality: CompiledLike;
  system?: string;
  model?: string;
}): string {
  const personality = extractCompiledText(compiledPersonality);
  const personalityText = personality.text.trim();
  const existingSystem = String(system ?? "");

  if (personalityText.length === 0) return existingSystem;
  if (existingSystem.trim().length === 0) return personalityText;

  const placement = personality.placement ?? defaultPlacement(model);
  if (placement === "start" || placement === "end") {
    if (placement === "start") {
      return concatSections([personalityText, existingSystem]).replace(/\n{3,}/g, "\n\n");
    }
    return concatSections([existingSystem, personalityText]).replace(/\n{3,}/g, "\n\n");
  }

  if (placement === "after_tools") {
    const section = detectToolsSection(existingSystem);
    if (!section) {
      return concatSections([personalityText, existingSystem]).replace(/\n{3,}/g, "\n\n");
    }

    const lines = splitLines(existingSystem);
    const before = lines.slice(0, section.end).join("\n");
    const after = lines.slice(section.end).join("\n");
    return concatSections([before, personalityText, after]).replace(/\n{3,}/g, "\n\n");
  }

  return concatSections([personalityText, existingSystem]).replace(/\n{3,}/g, "\n\n");
}
