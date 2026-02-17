import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_DIR = path.resolve(__dirname, "..", "profiles");

function readProfileYaml(name) {
  return fs.readFileSync(path.join(PROFILES_DIR, `${name}.yaml`), "utf-8");
}

const { listBundledProfiles, registerTools, registerResources } = await import("../dist/lib.js");

import {
  validateResolvedProfile,
  compileResolvedProfile
} from "@traits-dev/core";
import { parse as parseYaml } from "yaml";

// MCP SDK imports for contract tests
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

// --- Helper: create a connected MCP client + server pair ---

async function createTestClient() {
  const server = new McpServer(
    { name: "traits-test", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } }
  );
  registerTools(server);
  registerResources(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server, close: async () => { await client.close(); await server.close(); } };
}

// --- listBundledProfiles tests ---

test("listBundledProfiles: returns all 7 starter profiles", () => {
  const profiles = listBundledProfiles();
  assert.equal(profiles.length, 7);
  const names = profiles.map((p) => p.name).sort();
  assert.deepEqual(names, [
    "advisor", "architect", "educator", "haven", "pipeline", "resolve", "steward"
  ]);
});

test("listBundledProfiles: each profile has required fields", () => {
  const profiles = listBundledProfiles();
  for (const p of profiles) {
    assert.ok(p.name, `missing name`);
    assert.ok(p.filename, `missing filename for ${p.name}`);
    assert.ok(p.yamlContent.length > 0, `empty YAML for ${p.name}`);
    assert.ok(p.profile.meta, `missing meta for ${p.name}`);
    assert.ok(p.profile.identity, `missing identity for ${p.name}`);
    assert.ok(p.profile.voice, `missing voice for ${p.name}`);
  }
});

// --- MCP contract: tool listing ---

test("MCP contract: listTools returns all 3 tools", async () => {
  const { client, close } = await createTestClient();
  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["traits_compile", "traits_list_profiles", "traits_validate"]);
  } finally {
    await close();
  }
});

// --- MCP contract: tool execution ---

test("MCP contract: traits_validate with valid YAML", async () => {
  const { client, close } = await createTestClient();
  try {
    const yaml = readProfileYaml("resolve");
    const result = await client.callTool({ name: "traits_validate", arguments: { yaml } });
    assert.equal(result.isError, false);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.isValid, true);
  } finally {
    await close();
  }
});

test("MCP contract: traits_validate with invalid YAML", async () => {
  const { client, close } = await createTestClient();
  try {
    const yaml = 'schema: "v1.6"\nmeta:\n  name: "bad"\n  version: "1.0"\n  description: "Missing fields"\n';
    const result = await client.callTool({ name: "traits_validate", arguments: { yaml } });
    assert.equal(result.isError, true);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.isValid, false);
  } finally {
    await close();
  }
});

test("MCP contract: traits_validate with strict mode", async () => {
  const { client, close } = await createTestClient();
  try {
    const yaml = readProfileYaml("resolve");
    const result = await client.callTool({ name: "traits_validate", arguments: { yaml, strict: true } });
    // resolve is well-formed, should still pass in strict mode
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.isValid, true);
  } finally {
    await close();
  }
});

test("MCP contract: traits_compile returns personality text", async () => {
  const { client, close } = await createTestClient();
  try {
    const yaml = readProfileYaml("resolve");
    const result = await client.callTool({ name: "traits_compile", arguments: { yaml, model: "claude" } });
    assert.equal(result.isError, undefined);
    assert.ok(result.content[0].text.includes("[TRAITS PERSONALITY]"));
  } finally {
    await close();
  }
});

test("MCP contract: traits_compile with model override", async () => {
  const { client, close } = await createTestClient();
  try {
    const yaml = readProfileYaml("resolve");
    const claudeResult = await client.callTool({ name: "traits_compile", arguments: { yaml, model: "claude" } });
    const gptResult = await client.callTool({ name: "traits_compile", arguments: { yaml, model: "gpt-4o" } });
    // Both should produce personality text but with different content
    assert.ok(claudeResult.content[0].text.includes("[TRAITS PERSONALITY]"));
    assert.ok(gptResult.content[0].text.includes("[TRAITS PERSONALITY]"));
  } finally {
    await close();
  }
});

test("MCP contract: traits_list_profiles returns all profiles", async () => {
  const { client, close } = await createTestClient();
  try {
    const result = await client.callTool({ name: "traits_list_profiles", arguments: {} });
    const profiles = JSON.parse(result.content[0].text);
    assert.equal(profiles.length, 7);
    const names = profiles.map((p) => p.name).sort();
    assert.deepEqual(names, ["advisor", "architect", "educator", "haven", "pipeline", "resolve", "steward"]);
  } finally {
    await close();
  }
});

// --- MCP contract: resource listing ---

test("MCP contract: listResources returns static profile list", async () => {
  const { client, close } = await createTestClient();
  try {
    const { resources } = await client.listResources();
    assert.ok(resources.length >= 1);
    const profilesList = resources.find((r) => r.uri === "traits://profiles");
    assert.ok(profilesList, "traits://profiles static resource not found");
  } finally {
    await close();
  }
});

// --- MCP contract: resource reads ---

test("MCP contract: read traits://profiles returns JSON list", async () => {
  const { client, close } = await createTestClient();
  try {
    const result = await client.readResource({ uri: "traits://profiles" });
    const list = JSON.parse(result.contents[0].text);
    assert.equal(list.length, 7);
    assert.ok(list.find((p) => p.name === "resolve"));
  } finally {
    await close();
  }
});

test("MCP contract: read traits://profiles/resolve returns YAML", async () => {
  const { client, close } = await createTestClient();
  try {
    const result = await client.readResource({ uri: "traits://profiles/resolve" });
    assert.ok(result.contents[0].text.includes("schema:"));
    assert.ok(result.contents[0].text.includes("meta:"));
    assert.ok(result.contents[0].text.includes("resolve"));
  } finally {
    await close();
  }
});

test("MCP contract: read traits://profiles/resolve/compiled/claude returns compiled text", async () => {
  const { client, close } = await createTestClient();
  try {
    const result = await client.readResource({ uri: "traits://profiles/resolve/compiled/claude" });
    assert.ok(result.contents[0].text.includes("[TRAITS PERSONALITY]"));
  } finally {
    await close();
  }
});

test("MCP contract: read traits://profiles/resolve/compiled/gpt-4o returns compiled text", async () => {
  const { client, close } = await createTestClient();
  try {
    const result = await client.readResource({ uri: "traits://profiles/resolve/compiled/gpt-4o" });
    assert.ok(result.contents[0].text.includes("[TRAITS PERSONALITY]"));
  } finally {
    await close();
  }
});

test("MCP contract: read traits://profiles/nonexistent throws error", async () => {
  const { client, close } = await createTestClient();
  try {
    await assert.rejects(
      () => client.readResource({ uri: "traits://profiles/nonexistent" }),
      (err) => {
        assert.ok(err.message.includes("not found") || err.code !== undefined);
        return true;
      }
    );
  } finally {
    await close();
  }
});

// --- Core function tests (direct, no MCP transport) ---

test("traits_validate logic: valid YAML returns isValid true", () => {
  const yaml = readProfileYaml("resolve");
  const profile = parseYaml(yaml);
  const result = validateResolvedProfile(profile, { strict: false });
  assert.equal(result.isValid, true);
});

test("traits_compile logic: model override changes placement", () => {
  const yaml = readProfileYaml("resolve");
  const profile = parseYaml(yaml);
  const claudeCompiled = compileResolvedProfile(profile, { model: "claude" });
  const gptCompiled = compileResolvedProfile(profile, { model: "gpt-4o" });
  assert.equal(claudeCompiled.placement.recommended_position, "start");
  assert.equal(gptCompiled.placement.recommended_position, "after_tools");
});

test("resource logic: compiled profile text accessible for each profile", () => {
  const profiles = listBundledProfiles();
  for (const p of profiles) {
    const compiled = compileResolvedProfile(p.profile, { model: "unknown" });
    assert.ok(compiled.text.length > 0, `empty compiled text for ${p.name}`);
    assert.ok(compiled.text.includes("[TRAITS PERSONALITY]"), `missing header for ${p.name}`);
  }
});
