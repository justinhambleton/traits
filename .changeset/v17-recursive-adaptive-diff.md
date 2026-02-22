---
"@traits-dev/core": minor
"@traits-dev/cli": minor
---

v1.7: Recursive extends chains, adaptive compilation, and traits diff

- **Recursive extends chains**: Parent profiles can now declare their own `extends`, enabling multi-level inheritance hierarchies (e.g., grandparent → parent → child). Includes cycle detection (`E_EXTENDS_CYCLE`) and configurable depth limits (`E_EXTENDS_DEPTH`, default: 5).
- **Adaptive compilation**: Profiles with `adapt: true` dimensions now render an `[ADAPTIVE RANGES]` section in compiled output, instructing the model which dimensions may flex and within what bounds. Voice targets include inline range annotations.
- **`traits diff` command**: New CLI command and core `diffProfiles()` API for structural comparison of two profiles. Supports `--resolved` to compare raw vs extends-merged output, and `--json` for structured output.
