import { loadProfileFile, resolveExtends } from "../profile.js";
import { checkOverspec } from "./overspec.js";
import { validateSchema } from "./schema.js";
import { checkS001, checkS002, checkS003, checkS005, checkS008 } from "./safety.js";
import { checkS006, checkS007 } from "./inheritance.js";
import type {
  PersonalityProfile,
  ValidationCheckSummary,
  ValidationDiagnostic,
  ValidationResult
} from "../types.js";

function normalizeDiagnosticSeverity(
  diagnostic: ValidationDiagnostic,
  fallbackSeverity: "warning" | "error"
): ValidationDiagnostic {
  return {
    ...diagnostic,
    severity: diagnostic?.severity ?? fallbackSeverity
  };
}

function partitionDiagnostics(diagnostics: ValidationDiagnostic[]): {
  warnings: ValidationDiagnostic[];
  errors: ValidationDiagnostic[];
} {
  const warnings: ValidationDiagnostic[] = [];
  const errors: ValidationDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") {
      errors.push(diagnostic);
      continue;
    }
    warnings.push(diagnostic);
  }

  return { warnings, errors };
}

function promoteWarningsForStrictMode(
  warnings: ValidationDiagnostic[],
  strict: boolean
): ValidationDiagnostic[] {
  if (!strict) return [];
  return warnings.map((warning) => ({
    ...warning,
    severity: "error",
    promotedFrom: "warning",
    message: `[strict] ${warning.message}`
  }));
}

function computeExitCode(warnings: ValidationDiagnostic[], effectiveErrors: ValidationDiagnostic[]): number {
  if (effectiveErrors.length > 0) return 2;
  if (warnings.length > 0) return 1;
  return 0;
}

function summarizeCheck(diagnostics: ValidationDiagnostic[]): ValidationCheckSummary {
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning"
  ).length;
  if (errorCount > 0) {
    return { status: "error", errors: errorCount, warnings: warningCount };
  }
  if (warningCount > 0) {
    return { status: "warning", errors: 0, warnings: warningCount };
  }
  return { status: "pass", errors: 0, warnings: 0 };
}

function buildCompositionCheck(
  resolvedWarnings: ValidationDiagnostic[],
  resolvedErrors: ValidationDiagnostic[]
): ValidationCheckSummary {
  const compositionWarnings = resolvedWarnings.filter(
    (diagnostic) => diagnostic.code === "E_RESOLVE_EXTENDS"
  );
  const compositionErrors = resolvedErrors.filter(
    (diagnostic) =>
      diagnostic.code === "E_RESOLVE_EXTENDS" || diagnostic.code === "E_EXTENDS_CHAIN"
  );
  return summarizeCheck([...compositionWarnings, ...compositionErrors]);
}

function buildInheritanceCheck(
  warnings: ValidationDiagnostic[],
  errors: ValidationDiagnostic[]
): ValidationCheckSummary {
  const inheritanceWarnings = warnings.filter(
    (diagnostic) => diagnostic.code === "S006" || diagnostic.code === "S007"
  );
  const inheritanceErrors = errors.filter(
    (diagnostic) => diagnostic.code === "S006" || diagnostic.code === "S007"
  );
  return summarizeCheck([...inheritanceWarnings, ...inheritanceErrors]);
}

export function validateResolvedProfile(
  profile: PersonalityProfile,
  options: { strict?: boolean } = {}
): ValidationResult {
  const strict = Boolean(options.strict);
  const schemaValidation = validateSchema(profile);

  const overspec = checkOverspec(profile);
  const diagnostics = [
    ...schemaValidation.diagnostics,
    ...checkS001(profile),
    ...checkS002(profile),
    ...checkS003(profile),
    ...checkS005(profile),
    ...checkS008(profile),
    ...checkS007(profile),
    ...overspec.diagnostics
  ];

  const { warnings, errors } = partitionDiagnostics(diagnostics);
  const promotedWarnings = promoteWarningsForStrictMode(warnings, strict);
  const effectiveErrors = [...errors, ...promotedWarnings];

  return {
    parentPath: null,
    profile,
    strict,
    warnings,
    errors,
    promotedWarnings,
    effectiveErrors,
    constraintCount: overspec.total,
    constraintBreakdown: overspec.breakdown,
    checks: {
      ...schemaValidation.checks,
      composition: { status: "pass", errors: 0, warnings: 0 },
      inheritance: buildInheritanceCheck(warnings, errors)
    },
    isValid: effectiveErrors.length === 0,
    exitCode: computeExitCode(warnings, effectiveErrors)
  };
}

export function validateProfile(
  profilePath: string,
  options: { strict?: boolean; bundledProfilesDir?: string } = {}
): ValidationResult {
  const strict = Boolean(options.strict);
  let resolved: ReturnType<typeof resolveExtends>;

  try {
    resolved = resolveExtends(profilePath, options);
  } catch (error) {
    const diagnostic: ValidationDiagnostic = {
      code: "E_PARSE_PROFILE",
      severity: "error",
      message: `Failed to load profile: ${error instanceof Error ? error.message : String(error)}`
    };

    return {
      profilePath,
      parentPath: null,
      profile: null,
      strict,
      warnings: [],
      errors: [diagnostic],
      promotedWarnings: [],
      effectiveErrors: [diagnostic],
      constraintCount: 0,
      constraintBreakdown: {
        behavioral_rules: 0,
        vocabulary_preferred_terms: 0,
        vocabulary_forbidden_terms: 0,
        context_adaptations: 0
      },
      checks: {
        schema_structure: { status: "error", errors: 1, warnings: 0 },
        dimension_values: { status: "pass", errors: 0, warnings: 0 },
        adaptation_ranges: { status: "pass", errors: 0, warnings: 0 },
        composition: { status: "error", errors: 1, warnings: 0 }
      },
      isValid: false,
      exitCode: 2
    };
  }

  const resolvedWarnings = (resolved?.diagnostics?.warnings ?? []).map((diagnostic) =>
    normalizeDiagnosticSeverity(diagnostic, "warning")
  );
  const resolvedErrors = (resolved?.diagnostics?.errors ?? []).map((diagnostic) =>
    normalizeDiagnosticSeverity(diagnostic, "error")
  );

  let s006Diagnostics: ValidationDiagnostic[] = [];
  if (resolvedErrors.length === 0 && resolved.parentProfile) {
    try {
      const childProfile = loadProfileFile(profilePath);
      s006Diagnostics = checkS006(resolved.parentProfile, childProfile, resolved.profile);
    } catch (error) {
      s006Diagnostics = [
        {
          code: "E_INHERITANCE_VALIDATION",
          severity: "error",
          message: `Failed to evaluate inheritance checks: ${error instanceof Error ? error.message : String(error)}`
        }
      ];
    }
  }

  const normalizedS006Diagnostics = s006Diagnostics.map((diagnostic) =>
    normalizeDiagnosticSeverity(diagnostic, diagnostic.severity ?? "warning")
  );
  const s006Partition = partitionDiagnostics(normalizedS006Diagnostics);

  const profileValidation = validateResolvedProfile(resolved.profile, {
    strict: false
  });

  const warnings = [...resolvedWarnings, ...profileValidation.warnings, ...s006Partition.warnings];
  const errors = [...resolvedErrors, ...profileValidation.errors, ...s006Partition.errors];
  const promotedWarnings = promoteWarningsForStrictMode(warnings, strict);
  const effectiveErrors = [...errors, ...promotedWarnings];
  const compositionCheck = buildCompositionCheck(resolvedWarnings, resolvedErrors);
  const inheritanceCheck = buildInheritanceCheck(warnings, errors);

  return {
    profilePath,
    parentPath: resolved.parentPath,
    profile: resolved.profile,
    strict,
    warnings,
    errors,
    promotedWarnings,
    effectiveErrors,
    constraintCount: profileValidation.constraintCount,
    constraintBreakdown: profileValidation.constraintBreakdown,
    checks: {
      ...profileValidation.checks,
      composition: compositionCheck,
      inheritance: inheritanceCheck
    },
    isValid: effectiveErrors.length === 0,
    exitCode: computeExitCode(warnings, effectiveErrors)
  };
}
