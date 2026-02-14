import { asArray } from "../utils.js";
import type {
  ContextAdaptation,
  PersonalityProfile,
  ValidationDiagnostic
} from "../types.js";

const SAFETY_ADAPTATION_NAME = /(crisis|emergency|harm|suicid|self[-_ ]?harm)/i;

export function checkS006(
  parentProfile: PersonalityProfile,
  childProfile: PersonalityProfile,
  mergedProfile: PersonalityProfile
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  const childBehavioralRemovals = asArray<string>(childProfile.behavioral_rules_remove);
  const childForbiddenRemovals = asArray<string>(
    childProfile?.vocabulary?.forbidden_terms_remove
  );

  if (childBehavioralRemovals.length) {
    diagnostics.push({
      code: "S006",
      severity: "warning",
      message:
        "Explicit behavioral_rules_remove detected. Behavioral rules are safety-relevant."
    });
  }

  if (childForbiddenRemovals.length) {
    diagnostics.push({
      code: "S006",
      severity: "warning",
      message:
        "Explicit vocabulary.forbidden_terms_remove detected. Forbidden terms are safety-relevant."
    });
  }

  const parentBehavioralCount = asArray<string>(parentProfile.behavioral_rules).length;
  const parentForbiddenCount = asArray<string>(parentProfile?.vocabulary?.forbidden_terms).length;
  const mergedBehavioralCount = asArray<string>(mergedProfile.behavioral_rules).length;
  const mergedForbiddenCount = asArray<string>(mergedProfile?.vocabulary?.forbidden_terms).length;

  if (mergedBehavioralCount < parentBehavioralCount || mergedForbiddenCount < parentForbiddenCount) {
    diagnostics.push({
      code: "S006",
      severity: "error",
      message: "Merged profile has fewer safety constraints than parent profile."
    });
  }

  return diagnostics;
}

export function checkS007(profile: PersonalityProfile): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  for (const adaptation of asArray<ContextAdaptation>(profile.context_adaptations)) {
    if (!SAFETY_ADAPTATION_NAME.test(String(adaptation?.when ?? ""))) continue;
    const priority = Number(adaptation?.priority ?? 0);
    if (priority >= 100) continue;
    diagnostics.push({
      code: "S007",
      severity: "warning",
      message: `Safety adaptation "${adaptation.when}" should set priority: 100.`
    });
  }

  return diagnostics;
}
