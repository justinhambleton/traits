# Calibration Contracts (v1)

This folder defines machine-readable contracts for knowledge-base calibration runs.

## Scenario Input Contract

File: `scenarios.v1.json`

```json
{
  "version": "v1",
  "description": "Canonical calibration scenario set",
  "scenarios": [
    {
      "id": "string",
      "category": "standard|frustrated|edge|multi-turn|formal|casual|mixed",
      "domain": "string",
      "messages": [
        { "role": "user|assistant", "content": "string" }
      ],
      "expected_behavior": "string"
    }
  ]
}
```

Rules:
- `id` must be unique.
- `messages` must contain at least one item.
- `category` values align with core eval scenario validation.

## Raw Run Output Contract

Produced by calibration harness (planned: `experiment/scripts/calibrate-patterns.mjs`).

```json
{
  "version": "v1",
  "model": "claude|gpt",
  "generated_at": "ISO-8601",
  "scenario_set": "path or id",
  "results": [
    {
      "entry_type": "dimension|interaction",
      "dimension": "formality|warmth|verbosity|directness|empathy|humor",
      "level": "very-low|low|medium|high|very-high",
      "id": "interaction-id",
      "scenario_id": "string",
      "scores": {
        "tier1": 0.0,
        "tier2": 0.0,
        "combined": 0.0
      },
      "notes": "string"
    }
  ]
}
```

Notes:
- For `entry_type=dimension`, populate `dimension` + `level`; leave `id` empty.
- For `entry_type=interaction`, populate `id`; leave `dimension`/`level` empty.

## Calibration Updates Contract

This is the merge artifact consumed by `experiment/scripts/calibrate-from-json.mjs`.

```json
{
  "dimensions": [
    {
      "dimension": "formality|warmth|verbosity|directness|empathy|humor",
      "level": "very-low|low|medium|high|very-high",
      "pattern": "string",
      "adherence": 0.0
    }
  ],
  "interactions": [
    {
      "id": "string",
      "pattern": "string",
      "adherence": 0.0
    }
  ]
}
```

Merge behavior:
- `mergeCalibrationFile()` updates `pattern` and `adherence` where provided.
- Updated entries are marked `calibrated: true`.
- File-level `updated_at` is refreshed.
