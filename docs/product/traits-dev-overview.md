# traits.dev — Product Summary

## What it is

traits.dev is a developer SDK that treats AI voice and behavioral policy as infrastructure rather than ad-hoc prompt engineering. Developers define *how* their AI should communicate — its voice, boundaries, and behavioral rules — in a structured YAML configuration, and the compiler transforms that into model-specific system prompts optimized for Claude, GPT, or other targets.

The core insight: every team building on LLMs eventually writes voice and behavioral policy into their system prompts by hand, and every team does it badly. The prompts are fragile, untestable, model-coupled, and impossible to version or share. traits.dev makes voice policy a first-class, portable artifact with compile-time safety guarantees.

## The technical approach

**Schema-driven voice configuration.** A voice profile defines six voice dimensions — formality, warmth, verbosity, directness, empathy, humor — each set to one of five discrete levels. This isn't a slider or a temperature knob; each level maps to specific, calibrated prompt engineering patterns per target model. A `warmth: very-high` for Claude produces different prompt text than the same setting for GPT, because the models respond to different framing strategies.

**Compile-time safety architecture.** Seven safety checks (S001–S007) run during validation, before any prompt is generated. Unsafe behavioral rules are blocked outright. Protected refusal vocabulary is auto-restored if a profile tries to suppress it. Overspecification is flagged. Prompt injection patterns are detected. This isn't a runtime filter — it's a build gate. Unsafe profiles don't compile, the same way type errors don't build.

**Inheritance with safety preservation.** Profiles can extend parent profiles using append-only merge semantics for safety-critical arrays. A child profile that extends a healthcare base profile *cannot* silently drop the parent's safety rules. Explicit removal is possible but triggers S006 diagnostics — it's auditable and gatable in CI. This is `extends` for voice policy, with the same guarantees you'd expect from a schema migration system.

**Context adaptation at compile time.** Profiles declare context-triggered voice shifts — when a user is frustrated, in crisis, or in a compliance audit, the compiled prompt adjusts dimensions and injects context-specific behavioral rules. Conflict resolution is deterministic: priority descending, array-order tiebreak, last-write-wins per dimension. This replaces the typical pattern of runtime if/else prompt assembly with a declarative, testable configuration.

**Model-specific knowledge base.** The compiler doesn't just template the YAML into text. It selects from a calibrated knowledge base of per-dimension, per-level prompt patterns that have been measured for adherence against each target model. The calibration pipeline — scenario set, evaluation harness, adherence scoring, pattern update — is built into the project tooling, not a one-time manual effort.

**CLI-first developer workflow.** `traits init` scaffolds a profile. `traits validate` runs safety checks with exit codes suitable for CI. `traits compile` produces the system prompt with optional trace output explaining every pattern decision. `traits eval` scores responses against the profile. `traits import` bootstraps a profile from an existing system prompt. The entire loop is local-first, works offline, and produces machine-readable output.

## What makes it different

**Voice policy becomes portable and versionable.** A `.yaml` profile is a commitable artifact. It diffs cleanly, reviews in PRs, and can be shared across teams or published as a package. Switching from Claude to GPT doesn't mean rewriting your system prompt — you recompile against a different target.

**Safety is structural, not aspirational.** Most AI safety in production is "we hope the prompt is good enough." traits.dev enforces safety constraints at compile time. If your profile violates safety rules, it doesn't ship. If a child profile weakens its parent's protections, the validator catches it. This is the difference between a linter and a code review comment.

**The abstraction layer is the right one.** traits.dev doesn't try to own the model, the API, or the application framework. It owns the voice-policy-to-prompt compilation step. It produces a text block that you inject into whatever system prompt architecture you already have. This means it integrates with any stack — it's a build tool, not a platform.

**Calibration is measurable, not vibes.** The knowledge base patterns have measured adherence scores from a reproducible evaluation pipeline. When a pattern says it produces `warmth: high` behavior, that claim is backed by a score from a defined scenario set, not by someone reading the prompt and nodding. The calibration tooling ships with the SDK — teams can run their own measurements.

## The one-sentence version

traits.dev compiles structured voice and behavioral policy configurations into model-specific system prompts with compile-time safety guarantees, making AI voice portable, testable, and versionable the same way TypeScript made JavaScript type-safe.
