import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PROFILES_DIR = path.join(ROOT, "profiles");

function profileFile(name) {
  return path.join(PROFILES_DIR, name);
}

// Import public API and internal helpers from the built output
const { withPersonality, createPersonalityMiddleware, compileEagerly } = await import("../dist/index.js");

// --- withPersonality wrapper tests ---

test("withPersonality: wraps a model with personality middleware", () => {
  // Minimal LanguageModelV3 mock
  const mockModel = {
    specificationVersion: "v3",
    provider: "test",
    modelId: "claude-sonnet",
    defaultObjectGenerationMode: undefined,
    doGenerate: async () => ({}),
    doStream: async () => ({})
  };

  const wrapped = withPersonality(mockModel, profileFile("resolve.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });

  assert.ok(wrapped, "withPersonality should return a model");
  assert.equal(wrapped.specificationVersion, "v3");
  assert.equal(typeof wrapped.doGenerate, "function");
  assert.equal(typeof wrapped.doStream, "function");
});

test("withPersonality: accepts a PersonalityProfile object", () => {
  const mockModel = {
    specificationVersion: "v3",
    provider: "test",
    modelId: "gpt-4o",
    defaultObjectGenerationMode: undefined,
    doGenerate: async () => ({}),
    doStream: async () => ({})
  };

  const profile = {
    schema: "v1.6",
    meta: { name: "Test", version: "1.0", description: "Test profile" },
    identity: { role: "A test assistant" },
    voice: {
      formality: "medium",
      warmth: "high",
      verbosity: "low",
      directness: "high",
      empathy: "medium",
      humor: "low"
    }
  };

  const wrapped = withPersonality(mockModel, profile);
  assert.ok(wrapped, "withPersonality should return a model");
  assert.equal(wrapped.specificationVersion, "v3");
});

test("withPersonality: auto-detects model from modelId", () => {
  const mockModel = {
    specificationVersion: "v3",
    provider: "test",
    modelId: "claude-3-5-sonnet-20241022",
    defaultObjectGenerationMode: undefined,
    doGenerate: async () => ({}),
    doStream: async () => ({})
  };

  // Should not throw - model detection uses modelId
  const wrapped = withPersonality(mockModel, profileFile("resolve.yaml"), {
    bundledProfilesDir: PROFILES_DIR
  });
  assert.ok(wrapped);
});

// --- compileEagerly tests ---

test("compileEagerly: compiles a profile from file path", () => {
  const compiled = compileEagerly(profileFile("resolve.yaml"), "claude-sonnet", {
    bundledProfilesDir: PROFILES_DIR
  });
  assert.ok(compiled.text.length > 0);
  assert.equal(compiled.placement.recommended_position, "start");
  assert.ok(compiled.text.includes("[TRAITS PERSONALITY]"));
});

test("compileEagerly: compiles a PersonalityProfile object", () => {
  const profile = {
    schema: "v1.6",
    meta: { name: "Test", version: "1.0", description: "Test profile" },
    identity: { role: "A test assistant" },
    voice: {
      formality: "medium",
      warmth: "high",
      verbosity: "low",
      directness: "high",
      empathy: "medium",
      humor: "low"
    }
  };

  const compiled = compileEagerly(profile, "gpt-4o");
  assert.ok(compiled.text.length > 0);
  assert.equal(compiled.placement.recommended_position, "after_tools");
});

test("compileEagerly: detects Claude model family", () => {
  const profile = {
    schema: "v1.6",
    meta: { name: "Test", version: "1.0", description: "Test profile" },
    identity: { role: "A test assistant" },
    voice: {
      formality: "medium",
      warmth: "medium",
      verbosity: "medium",
      directness: "medium",
      empathy: "medium",
      humor: "low"
    }
  };

  const compiled = compileEagerly(profile, "claude-3-5-sonnet-20241022");
  assert.equal(compiled.placement.recommended_position, "start");
});

test("compileEagerly: detects GPT model family", () => {
  const profile = {
    schema: "v1.6",
    meta: { name: "Test", version: "1.0", description: "Test profile" },
    identity: { role: "A test assistant" },
    voice: {
      formality: "medium",
      warmth: "medium",
      verbosity: "medium",
      directness: "medium",
      empathy: "medium",
      humor: "low"
    }
  };

  const compiled = compileEagerly(profile, "gpt-4o-mini");
  assert.equal(compiled.placement.recommended_position, "after_tools");
});

test("compileEagerly: model override takes precedence", () => {
  const profile = {
    schema: "v1.6",
    meta: { name: "Test", version: "1.0", description: "Test profile" },
    identity: { role: "A test assistant" },
    voice: {
      formality: "medium",
      warmth: "medium",
      verbosity: "medium",
      directness: "medium",
      empathy: "medium",
      humor: "low"
    }
  };

  // Model ID says Claude, but override says GPT
  const compiled = compileEagerly(profile, "claude-sonnet", { model: "gpt-4o" });
  assert.equal(compiled.placement.recommended_position, "after_tools");
});

// --- createPersonalityMiddleware tests ---

test("createPersonalityMiddleware: returns V3 middleware", () => {
  const compiled = compileEagerly(profileFile("resolve.yaml"), "claude-sonnet", {
    bundledProfilesDir: PROFILES_DIR
  });
  const middleware = createPersonalityMiddleware(compiled);
  assert.equal(middleware.specificationVersion, "v3");
  assert.equal(typeof middleware.transformParams, "function");
});

test("createPersonalityMiddleware: prepends system message when none exists", async () => {
  const compiled = compileEagerly(profileFile("resolve.yaml"), "claude-sonnet", {
    bundledProfilesDir: PROFILES_DIR
  });
  const middleware = createPersonalityMiddleware(compiled);

  const params = {
    prompt: [
      { role: "user", content: [{ type: "text", text: "Hello" }] }
    ]
  };

  const result = await middleware.transformParams({ type: "generate", params, model: {} });

  assert.equal(result.prompt.length, 2);
  assert.equal(result.prompt[0].role, "system");
  assert.ok(result.prompt[0].content.includes("[TRAITS PERSONALITY]"));
  assert.equal(result.prompt[1].role, "user");
});

test("createPersonalityMiddleware: merges with existing system message", async () => {
  const compiled = compileEagerly(profileFile("resolve.yaml"), "claude-sonnet", {
    bundledProfilesDir: PROFILES_DIR
  });
  const middleware = createPersonalityMiddleware(compiled);

  const params = {
    prompt: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: [{ type: "text", text: "Hello" }] }
    ]
  };

  const result = await middleware.transformParams({ type: "generate", params, model: {} });

  // Should still have 2 messages (system merged, not duplicated)
  assert.equal(result.prompt.length, 2);
  assert.equal(result.prompt[0].role, "system");
  assert.ok(result.prompt[0].content.includes("[TRAITS PERSONALITY]"));
  assert.ok(result.prompt[0].content.includes("You are a helpful assistant."));
});

test("createPersonalityMiddleware: does not modify original params", async () => {
  const compiled = compileEagerly(profileFile("resolve.yaml"), "claude-sonnet", {
    bundledProfilesDir: PROFILES_DIR
  });
  const middleware = createPersonalityMiddleware(compiled);

  const params = {
    prompt: [
      { role: "user", content: [{ type: "text", text: "Hello" }] }
    ]
  };

  const originalLength = params.prompt.length;
  await middleware.transformParams({ type: "generate", params, model: {} });

  // Original params should be unchanged
  assert.equal(params.prompt.length, originalLength);
});

test("createPersonalityMiddleware: compilation happens once, not per request", async () => {
  const compiled = compileEagerly(profileFile("resolve.yaml"), "claude-sonnet", {
    bundledProfilesDir: PROFILES_DIR
  });
  const middleware = createPersonalityMiddleware(compiled);

  const params1 = {
    prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }]
  };
  const params2 = {
    prompt: [{ role: "user", content: [{ type: "text", text: "World" }] }]
  };

  const result1 = await middleware.transformParams({ type: "generate", params: params1, model: {} });
  const result2 = await middleware.transformParams({ type: "generate", params: params2, model: {} });

  // Both should have the same personality text (compiled once)
  assert.equal(result1.prompt[0].content, result2.prompt[0].content);
});
