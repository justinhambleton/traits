import test from "node:test";
import assert from "node:assert/strict";

import { listBuiltInEvalSuites, loadBuiltInEvalSuite } from "../dist/internal.js";

test("built-in eval suites expose support/healthcare/developer/educator/advisor with 8-10 scenarios", () => {
  const suites = listBuiltInEvalSuites();
  const byId = new Map(suites.map((suite) => [suite.id, suite]));

  for (const id of ["support", "healthcare", "developer", "educator", "advisor"]) {
    assert.ok(byId.has(id));
    const summary = byId.get(id);
    assert.ok(summary.scenarioCount >= 8);
    assert.ok(summary.scenarioCount <= 10);
  }
});

test("loadBuiltInEvalSuite returns valid scenario contracts", () => {
  for (const id of ["support", "healthcare", "developer", "educator", "advisor"]) {
    const suite = loadBuiltInEvalSuite(id);
    assert.ok(suite);
    assert.ok(suite.scenarios.length >= 8);
    for (const scenario of suite.scenarios) {
      assert.equal(typeof scenario.id, "string");
      assert.ok(scenario.id.length > 0);
      assert.ok(
        ["standard", "frustrated", "edge", "multi-turn", "formal", "casual", "mixed"].includes(
          scenario.category
        )
      );
      assert.ok(Array.isArray(scenario.messages));
      assert.ok(scenario.messages.length > 0);
      assert.ok(
        scenario.messages.every(
          (message) =>
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" &&
            message.content.length > 0
        )
      );
      assert.equal(typeof scenario.expected_behavior, "string");
      assert.ok(scenario.expected_behavior.length > 0);
    }
  }
});

test("loadBuiltInEvalSuite returns null for unknown suite", () => {
  assert.equal(loadBuiltInEvalSuite("unknown-suite"), null);
});
