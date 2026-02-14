import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileProfile, injectPersonality } from "../dist/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");

function profileFile(name) {
  return path.join(PROFILES_DIR, name);
}

test("injectPersonality: Claude placement prepends to system prompt", () => {
  const compiled = compileProfile(profileFile("resolve.yaml"), {
    model: "claude-sonnet",
    bundledProfilesDir: PROFILES_DIR
  });
  const system = [
    "## Tools",
    "- search: look up resources",
    "",
    "## Knowledge",
    "- Use internal docs first"
  ].join("\n");

  const injected = injectPersonality({
    compiledPersonality: compiled,
    system,
    model: "claude-sonnet"
  });

  assert.ok(injected.startsWith("[TRAITS PERSONALITY]"));
  assert.ok(injected.includes("## Tools"));
});

test("injectPersonality: GPT placement inserts after tools section", () => {
  const compiled = compileProfile(profileFile("resolve.yaml"), {
    model: "gpt-4o",
    bundledProfilesDir: PROFILES_DIR
  });
  const system = [
    "## Tools",
    "- search: look up resources",
    "",
    "## Knowledge",
    "- Use internal docs first"
  ].join("\n");

  const injected = injectPersonality({
    compiledPersonality: compiled,
    system,
    model: "gpt-4o"
  });

  const personalityIndex = injected.indexOf("[TRAITS PERSONALITY]");
  const toolsIndex = injected.indexOf("## Tools");
  const knowledgeIndex = injected.indexOf("## Knowledge");

  assert.ok(toolsIndex >= 0);
  assert.ok(personalityIndex > toolsIndex);
  assert.ok(personalityIndex < knowledgeIndex);
});

test("injectPersonality: fallback prepends when tools section is not found", () => {
  const compiled = compileProfile(profileFile("resolve.yaml"), {
    model: "gpt-4o",
    bundledProfilesDir: PROFILES_DIR
  });
  const system = "You are an assistant with a compact response style.";

  const injected = injectPersonality({
    compiledPersonality: compiled,
    system,
    model: "gpt-4o"
  });

  assert.ok(injected.startsWith("[TRAITS PERSONALITY]"));
});

test("injectPersonality: safety floor is not appended again", () => {
  const compiled = compileProfile(profileFile("resolve.yaml"), {
    model: "gpt-4o",
    bundledProfilesDir: PROFILES_DIR
  });
  const system = [
    "<tools>",
    "search",
    "</tools>",
    "",
    "## Knowledge",
    "Use docs"
  ].join("\n");

  const injected = injectPersonality({
    compiledPersonality: compiled,
    system,
    model: "gpt-4o"
  });

  const matches = injected.match(/\[SAFETY FLOOR\]/g) ?? [];
  assert.equal(matches.length, 1);
});
