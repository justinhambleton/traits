import test from "node:test";
import assert from "node:assert/strict";

import { diffProfiles } from "../dist/index.js";

function makeProfile(overrides = {}) {
  return {
    schema: "v1.6",
    meta: { name: "test", version: "1.0.0", description: "test profile" },
    identity: { role: "assistant" },
    voice: {
      formality: "medium",
      warmth: "medium",
      verbosity: "medium",
      directness: "medium",
      empathy: "medium",
      humor: "very-low"
    },
    vocabulary: { preferred_terms: [], forbidden_terms: [] },
    behavioral_rules: [],
    context_adaptations: [],
    ...overrides
  };
}

// 1. Identical profiles → zero changes
test("diffProfiles: identical profiles produce zero changes", () => {
  const a = makeProfile();
  const b = makeProfile();
  const diff = diffProfiles(a, b);

  assert.equal(diff.changes.length, 0);
  assert.equal(diff.summary.added, 0);
  assert.equal(diff.summary.removed, 0);
  assert.equal(diff.summary.modified, 0);
});

// 2. Voice dimension changed → modified entry
test("diffProfiles: voice dimension change produces modified entry", () => {
  const a = makeProfile({ voice: { formality: "medium", warmth: "medium", verbosity: "medium", directness: "medium", empathy: "medium", humor: "very-low" } });
  const b = makeProfile({ voice: { formality: "high", warmth: "medium", verbosity: "medium", directness: "medium", empathy: "medium", humor: "very-low" } });

  const diff = diffProfiles(a, b);

  const formalityChange = diff.changes.find((c) => c.path === "voice.formality");
  assert.ok(formalityChange);
  assert.equal(formalityChange.type, "modified");
  assert.equal(formalityChange.oldValue, "medium");
  assert.equal(formalityChange.newValue, "high");
});

// 3. Behavioral rule added → added entry
test("diffProfiles: behavioral rule added produces added entry", () => {
  const a = makeProfile({ behavioral_rules: ["Rule one"] });
  const b = makeProfile({ behavioral_rules: ["Rule one", "Rule two"] });

  const diff = diffProfiles(a, b);

  const added = diff.changes.find((c) => c.path === "behavioral_rules[]" && c.type === "added");
  assert.ok(added);
  assert.equal(added.newValue, "Rule two");
  assert.equal(diff.summary.added, 1);
});

// 4. Behavioral rule removed → removed entry
test("diffProfiles: behavioral rule removed produces removed entry", () => {
  const a = makeProfile({ behavioral_rules: ["Rule one", "Rule two"] });
  const b = makeProfile({ behavioral_rules: ["Rule one"] });

  const diff = diffProfiles(a, b);

  const removed = diff.changes.find((c) => c.path === "behavioral_rules[]" && c.type === "removed");
  assert.ok(removed);
  assert.equal(removed.oldValue, "Rule two");
  assert.equal(diff.summary.removed, 1);
});

// 5. Context adaptation modified (same when key) → modified entry
test("diffProfiles: context adaptation modified produces modified entry", () => {
  const a = makeProfile({
    context_adaptations: [{ when: "vip_user", inject: ["Be helpful"] }]
  });
  const b = makeProfile({
    context_adaptations: [{ when: "vip_user", inject: ["Be very helpful", "Offer premium support"] }]
  });

  const diff = diffProfiles(a, b);

  const modified = diff.changes.find((c) => c.path === "context_adaptations[vip_user]" && c.type === "modified");
  assert.ok(modified);
});

// 6. Identity field changed → modified entry
test("diffProfiles: identity backstory change produces modified entry", () => {
  const a = makeProfile({ identity: { role: "assistant", backstory: "Original backstory" } });
  const b = makeProfile({ identity: { role: "assistant", backstory: "Updated backstory" } });

  const diff = diffProfiles(a, b);

  const change = diff.changes.find((c) => c.path === "identity.backstory");
  assert.ok(change);
  assert.equal(change.type, "modified");
  assert.equal(change.oldValue, "Original backstory");
  assert.equal(change.newValue, "Updated backstory");
});

// 7. Context adaptation added → added entry
test("diffProfiles: context adaptation added produces added entry", () => {
  const a = makeProfile({ context_adaptations: [] });
  const b = makeProfile({
    context_adaptations: [{ when: "compliance_audit", inject: ["Document all actions"] }]
  });

  const diff = diffProfiles(a, b);

  const added = diff.changes.find((c) => c.path === "context_adaptations[compliance_audit]" && c.type === "added");
  assert.ok(added);
  assert.equal(diff.summary.added, 1);
});

// 8. Vocabulary terms diffed correctly
test("diffProfiles: vocabulary preferred and forbidden terms diff correctly", () => {
  const a = makeProfile({
    vocabulary: { preferred_terms: ["hello", "welcome"], forbidden_terms: ["unfortunately"] }
  });
  const b = makeProfile({
    vocabulary: { preferred_terms: ["hello", "greetings"], forbidden_terms: ["unfortunately", "calm down"] }
  });

  const diff = diffProfiles(a, b);

  const preferredAdded = diff.changes.find(
    (c) => c.path === "vocabulary.preferred_terms[]" && c.type === "added"
  );
  assert.ok(preferredAdded);
  assert.equal(preferredAdded.newValue, "greetings");

  const preferredRemoved = diff.changes.find(
    (c) => c.path === "vocabulary.preferred_terms[]" && c.type === "removed"
  );
  assert.ok(preferredRemoved);
  assert.equal(preferredRemoved.oldValue, "welcome");

  const forbiddenAdded = diff.changes.find(
    (c) => c.path === "vocabulary.forbidden_terms[]" && c.type === "added"
  );
  assert.ok(forbiddenAdded);
  assert.equal(forbiddenAdded.newValue, "calm down");
});

// 9. Summary counts are correct
test("diffProfiles: summary counts match change types", () => {
  const a = makeProfile({
    voice: { formality: "medium", warmth: "medium", verbosity: "medium", directness: "medium", empathy: "medium", humor: "very-low" },
    behavioral_rules: ["Rule one", "Rule two"],
    context_adaptations: [{ when: "test", inject: ["old"] }]
  });
  const b = makeProfile({
    voice: { formality: "high", warmth: "medium", verbosity: "medium", directness: "medium", empathy: "medium", humor: "very-low" },
    behavioral_rules: ["Rule one", "Rule three"],
    context_adaptations: [{ when: "test", inject: ["new"] }, { when: "new_ctx", inject: ["added"] }]
  });

  const diff = diffProfiles(a, b);

  assert.equal(diff.summary.modified, diff.changes.filter((c) => c.type === "modified").length);
  assert.equal(diff.summary.added, diff.changes.filter((c) => c.type === "added").length);
  assert.equal(diff.summary.removed, diff.changes.filter((c) => c.type === "removed").length);
  assert.ok(diff.summary.added > 0);
  assert.ok(diff.summary.removed > 0);
  assert.ok(diff.summary.modified > 0);
});
