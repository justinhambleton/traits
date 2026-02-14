function symbolForStatus(status) {
  if (status === "error") return "✗";
  if (status === "warning") return "⚠";
  return "✓";
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatCheckLine(label, check) {
  return `${symbolForStatus(check.status)} ${label}`;
}

function formatDiagnostic(diagnostic) {
  const label = diagnostic.severity === "error" ? "ERROR" : "WARNING";
  return `${label} [${diagnostic.code}]: ${diagnostic.message}`;
}

function countSafetyDiagnostics(diagnostics) {
  return diagnostics.filter((diagnostic) => /^S00[1-7]$/.test(String(diagnostic.code))).length;
}

export function toValidationResultObject(result) {
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

export function formatValidationResult(result) {
  const output = [];
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
  if ((result.effectiveErrors ?? []).length > 0) {
    output.push(
      `Profile is invalid: ${pluralize(
        result.effectiveErrors.length,
        "error"
      )}, ${pluralize((result.warnings ?? []).length, "warning")}.`
    );
  } else if ((result.warnings ?? []).length > 0) {
    output.push(`Profile is valid with ${pluralize(result.warnings.length, "warning")}.`);
  } else {
    output.push("Profile is valid.");
  }

  return output.join("\n");
}
