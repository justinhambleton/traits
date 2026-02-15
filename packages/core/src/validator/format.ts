import type { ValidationCheckSummary, ValidationDiagnostic, ValidationResult } from "../types.js";

type ValidationResultObject = {
  profilePath: string | null;
  parentPath: string | null;
  strict: boolean;
  isValid: boolean;
  exitCode: number;
  checks: Record<string, ValidationCheckSummary>;
  constraintCount: number;
  constraintBreakdown: Record<string, number>;
  diagnostics: {
    errors: ValidationDiagnostic[];
    warnings: ValidationDiagnostic[];
    promotedWarnings: ValidationDiagnostic[];
    effectiveErrors: ValidationDiagnostic[];
  };
};

function symbolForStatus(status?: string): string {
  if (status === "error") return "✗";
  if (status === "warning") return "⚠";
  return "✓";
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatCheckLine(label: string, check: Partial<ValidationCheckSummary>): string {
  return `${symbolForStatus(check.status)} ${label}`;
}

function formatDiagnostic(diagnostic: ValidationDiagnostic): string {
  const label = diagnostic.severity === "error" ? "ERROR" : "WARNING";
  return `${label} [${diagnostic.code}]: ${diagnostic.message}`;
}

function countSafetyDiagnostics(diagnostics: ValidationDiagnostic[]): number {
  return diagnostics.filter((diagnostic) => /^S00[1-8]$/.test(String(diagnostic.code))).length;
}

export function toValidationResultObject(result: Partial<ValidationResult>): ValidationResultObject {
  return {
    profilePath: result.profilePath ?? null,
    parentPath: result.parentPath ?? null,
    strict: Boolean(result.strict),
    isValid: Boolean(result.isValid),
    exitCode: result.exitCode ?? 2,
    checks: result.checks ?? {},
    constraintCount: result.constraintCount ?? 0,
    constraintBreakdown: result.constraintBreakdown ?? {},
    diagnostics: {
      errors: result.errors ?? [],
      warnings: result.warnings ?? [],
      promotedWarnings: result.promotedWarnings ?? [],
      effectiveErrors: result.effectiveErrors ?? []
    }
  };
}

export function formatValidationResult(result: Partial<ValidationResult>): string {
  const output: string[] = [];
  const schemaVersion = result?.profile?.schema ? ` (${result.profile.schema})` : "";
  const checks = result.checks ?? {};
  output.push(
    formatCheckLine(`Schema valid${schemaVersion}`, checks.schema_structure ?? { status: "pass" })
  );
  output.push(
    formatCheckLine(
      "Dimension values within range",
      checks.dimension_values ?? { status: "pass" }
    )
  );
  output.push(
    formatCheckLine(
      "Adaptation ranges valid (floor <= target <= ceiling)",
      checks.adaptation_ranges ?? { status: "pass" }
    )
  );
  output.push(
    formatCheckLine(
      "Composition references resolved",
      checks.composition ?? { status: "pass" }
    )
  );
  if (result.strict) {
    output.push("⚠ Strict mode: warnings are treated as errors");
  }

  const safetyWarnings = countSafetyDiagnostics(
    (result.warnings ?? []).filter((diagnostic) => diagnostic.severity === "warning")
  );
  const safetyErrors = countSafetyDiagnostics(
    (result.errors ?? []).filter((diagnostic) => diagnostic.severity === "error")
  );
  const safetyTotal = safetyWarnings + safetyErrors;
  if (safetyTotal === 0) {
    output.push("✓ Safety analysis: no issues");
  } else if (safetyErrors > 0) {
    output.push(
      `✗ Safety analysis: ${pluralize(safetyErrors, "error")}, ${pluralize(safetyWarnings, "warning")}`
    );
  } else {
    output.push(`⚠ Safety analysis: ${pluralize(safetyWarnings, "warning")}`);
  }

  const constraintCount = Number(result.constraintCount ?? 0);
  output.push(`✓ Constraint count: ${constraintCount}`);

  const diagnostics = [...(result.errors ?? []), ...(result.warnings ?? [])];
  if (diagnostics.length > 0) {
    output.push("");
    for (const diagnostic of diagnostics) {
      output.push(formatDiagnostic(diagnostic));
    }
  }

  output.push("");
  const effectiveErrors = result.effectiveErrors ?? [];
  const warnings = result.warnings ?? [];
  if (effectiveErrors.length > 0) {
    output.push(
      `Profile is invalid: ${pluralize(
        effectiveErrors.length,
        "error"
      )}, ${pluralize(warnings.length, "warning")}.`
    );
  } else if (warnings.length > 0) {
    output.push(`Profile is valid with ${pluralize(warnings.length, "warning")}.`);
  } else {
    output.push("Profile is valid.");
  }

  return output.join("\n");
}
