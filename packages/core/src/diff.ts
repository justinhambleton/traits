import type { PersonalityProfile, RuleConstraint } from "./types.js";

export interface DiffEntry {
  path: string;
  type: "added" | "removed" | "modified";
  oldValue?: unknown;
  newValue?: unknown;
}

export interface ProfileDiff {
  changes: DiffEntry[];
  summary: { added: number; removed: number; modified: number };
}

function normalizeRuleToString(rule: RuleConstraint): string {
  if (typeof rule === "string") return rule;
  return rule.rule;
}

function diffScalar(path: string, a: unknown, b: unknown, changes: DiffEntry[]): void {
  if (a === undefined && b === undefined) return;
  if (a === undefined) {
    changes.push({ path, type: "added", newValue: b });
    return;
  }
  if (b === undefined) {
    changes.push({ path, type: "removed", oldValue: a });
    return;
  }
  const aStr = JSON.stringify(a);
  const bStr = JSON.stringify(b);
  if (aStr !== bStr) {
    changes.push({ path, type: "modified", oldValue: a, newValue: b });
  }
}

function diffStringArrays(
  path: string,
  a: string[],
  b: string[],
  changes: DiffEntry[]
): void {
  const setA = new Set(a);
  const setB = new Set(b);

  for (const item of b) {
    if (!setA.has(item)) {
      changes.push({ path: `${path}[]`, type: "added", newValue: item });
    }
  }
  for (const item of a) {
    if (!setB.has(item)) {
      changes.push({ path: `${path}[]`, type: "removed", oldValue: item });
    }
  }
}

function diffVoice(
  voiceA: Record<string, unknown>,
  voiceB: Record<string, unknown>,
  changes: DiffEntry[]
): void {
  const allDims = new Set([...Object.keys(voiceA), ...Object.keys(voiceB)]);
  for (const dim of allDims) {
    diffScalar(`voice.${dim}`, voiceA[dim], voiceB[dim], changes);
  }
}

function diffBehavioralRules(
  a: RuleConstraint[],
  b: RuleConstraint[],
  changes: DiffEntry[]
): void {
  const stringsA = a.map(normalizeRuleToString);
  const stringsB = b.map(normalizeRuleToString);
  const setA = new Set(stringsA);
  const setB = new Set(stringsB);

  for (const rule of stringsB) {
    if (!setA.has(rule)) {
      changes.push({ path: "behavioral_rules[]", type: "added", newValue: rule });
    }
  }
  for (const rule of stringsA) {
    if (!setB.has(rule)) {
      changes.push({ path: "behavioral_rules[]", type: "removed", oldValue: rule });
    }
  }

  // Check locked status changes for rules present in both
  for (const ruleStr of stringsA) {
    if (!setB.has(ruleStr)) continue;
    const entryA = a.find((r) => normalizeRuleToString(r) === ruleStr);
    const entryB = b.find((r) => normalizeRuleToString(r) === ruleStr);
    const lockedA = typeof entryA === "object" && entryA.locked === true;
    const lockedB = typeof entryB === "object" && entryB.locked === true;
    if (lockedA !== lockedB) {
      changes.push({
        path: `behavioral_rules[${JSON.stringify(ruleStr)}].locked`,
        type: "modified",
        oldValue: lockedA,
        newValue: lockedB
      });
    }
  }
}

function diffContextAdaptations(
  a: Array<{ when: string; [key: string]: unknown }>,
  b: Array<{ when: string; [key: string]: unknown }>,
  changes: DiffEntry[]
): void {
  const mapA = new Map(a.map((item) => [item.when, item]));
  const mapB = new Map(b.map((item) => [item.when, item]));

  for (const [when, entry] of mapB) {
    if (!mapA.has(when)) {
      changes.push({
        path: `context_adaptations[${when}]`,
        type: "added",
        newValue: entry
      });
    } else {
      const old = mapA.get(when);
      if (JSON.stringify(old) !== JSON.stringify(entry)) {
        changes.push({
          path: `context_adaptations[${when}]`,
          type: "modified",
          oldValue: old,
          newValue: entry
        });
      }
    }
  }
  for (const [when, entry] of mapA) {
    if (!mapB.has(when)) {
      changes.push({
        path: `context_adaptations[${when}]`,
        type: "removed",
        oldValue: entry
      });
    }
  }
}

export function diffProfiles(
  profileA: PersonalityProfile,
  profileB: PersonalityProfile
): ProfileDiff {
  const changes: DiffEntry[] = [];

  // Meta
  diffScalar("meta.name", profileA.meta?.name, profileB.meta?.name, changes);
  diffScalar("meta.version", profileA.meta?.version, profileB.meta?.version, changes);
  diffScalar("meta.description", profileA.meta?.description, profileB.meta?.description, changes);
  diffScalar("meta.tags", profileA.meta?.tags, profileB.meta?.tags, changes);

  // Identity
  diffScalar("identity.role", profileA.identity?.role, profileB.identity?.role, changes);
  diffScalar("identity.backstory", profileA.identity?.backstory, profileB.identity?.backstory, changes);

  // Voice
  diffVoice(profileA.voice ?? {}, profileB.voice ?? {}, changes);

  // Vocabulary
  const vocabA = profileA.vocabulary ?? {};
  const vocabB = profileB.vocabulary ?? {};
  diffStringArrays(
    "vocabulary.preferred_terms",
    (vocabA.preferred_terms ?? []) as string[],
    (vocabB.preferred_terms ?? []) as string[],
    changes
  );
  diffStringArrays(
    "vocabulary.forbidden_terms",
    (vocabA.forbidden_terms ?? []) as string[],
    (vocabB.forbidden_terms ?? []) as string[],
    changes
  );

  // Behavioral rules
  diffBehavioralRules(
    (profileA.behavioral_rules ?? []) as RuleConstraint[],
    (profileB.behavioral_rules ?? []) as RuleConstraint[],
    changes
  );

  // Context adaptations
  diffContextAdaptations(
    (profileA.context_adaptations ?? []) as Array<{ when: string }>,
    (profileB.context_adaptations ?? []) as Array<{ when: string }>,
    changes
  );

  // Capabilities
  diffScalar("capabilities", profileA.capabilities, profileB.capabilities, changes);

  const summary = {
    added: changes.filter((c) => c.type === "added").length,
    removed: changes.filter((c) => c.type === "removed").length,
    modified: changes.filter((c) => c.type === "modified").length
  };

  return { changes, summary };
}
