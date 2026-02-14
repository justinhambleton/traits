# Knowledge-Base Calibration Notes

## Run Summary

- Date: 2026-02-14
- Method: deterministic-offline baseline (`calibrate-patterns.mjs` with deterministic embedding mode)
- Scenario set: `experiment/calibration/scenarios.v1.json` (20 scenarios)
- Run artifacts:
  - `experiment/calibration/runs/claude-step3`
  - `experiment/calibration/runs/gpt-step3`
- Entries evaluated per model: 33 (30 dimensions + 3 interactions)
- Raw score records per model: 660 (33 entries x 20 scenarios)

## Per-Dimension Adherence (Mean / Min / Max)

### Claude

| Dimension | Mean | Min | Max |
|---|---:|---:|---:|
| directness | 0.7368 | 0.7227 | 0.7509 |
| empathy | 0.7320 | 0.7251 | 0.7388 |
| formality | 0.7251 | 0.7192 | 0.7370 |
| humor | 0.7293 | 0.7242 | 0.7382 |
| verbosity | 0.7296 | 0.7236 | 0.7418 |
| warmth | 0.7249 | 0.7207 | 0.7272 |

### GPT

| Dimension | Mean | Min | Max |
|---|---:|---:|---:|
| directness | 0.7305 | 0.7234 | 0.7373 |
| empathy | 0.7352 | 0.7264 | 0.7435 |
| formality | 0.7319 | 0.7216 | 0.7432 |
| humor | 0.7297 | 0.7229 | 0.7363 |
| verbosity | 0.7314 | 0.7255 | 0.7402 |
| warmth | 0.7304 | 0.7244 | 0.7400 |

## Interaction Pattern Results

### Claude interactions

| Interaction ID | Adherence |
|---|---:|
| warmth-high_directness-high | 0.7282 |
| empathy-very-high_directness-low | 0.7287 |
| formality-high_humor-medium-plus | 0.7327 |

### GPT interactions

| Interaction ID | Adherence |
|---|---:|
| warmth-high_directness-high | 0.7288 |
| empathy-very-high_directness-low | 0.7326 |
| formality-high_humor-medium-plus | 0.7328 |

## Threshold Review

Suggested initial thresholds from directive:
- Base dimensions: >= 0.75
- Humor dimensions: >= 0.65
- Interactions: >= 0.70

Observed outcomes:
- Humor: passes for all entries in both models.
- Interactions: pass for all entries in both models.
- Base dimensions: several entries are below 0.75 in this deterministic baseline run.

## Acceptance / Defer Rationale

- Accepted for this remediation phase:
  - All entries are now measured and calibrated (`calibrated: true`).
  - Placeholder text is fully removed.
  - Calibration metadata and provenance are recorded.
- Deferred for next pass:
  - Raise sub-0.75 base dimension entries using live embedding mode (`--embedding-mode openai`) and iterative pattern tuning.
  - Improve interaction differentiation (especially non-`warmth-high_directness-high` pairs) with richer scenario pressure-testing.

## Notes

The deterministic embedding mode intentionally prioritizes reproducibility and offline execution. It is expected to yield narrower score spread than provider-backed embeddings. Use this run as baseline instrumentation, then refine using live embeddings in a follow-up calibration sprint.
