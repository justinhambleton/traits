import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { applyCalibrationUpdates, mergeCalibrationFile } from "../src/index.js";

test("applyCalibrationUpdates applies dimension and interaction scores", () => {
  const input = {
    version: "claude-baseline-v1",
    dimensions: {
      warmth: {
        high: {
          pattern: "old",
          adherence: 0.5,
          calibrated: false
        }
      }
    },
    interactions: {}
  };

  const updates = {
    dimensions: [
      {
        dimension: "warmth",
        level: "high",
        pattern: "new",
        adherence: 0.82
      }
    ],
    interactions: [
      {
        id: "warmth-high_directness-high",
        pattern: "interaction update",
        adherence: 0.76
      }
    ]
  };

  const result = applyCalibrationUpdates(input, updates);
  assert.equal(result.summary.dimension_updates, 1);
  assert.equal(result.summary.interaction_updates, 1);
  assert.equal(result.data.dimensions.warmth.high.pattern, "new");
  assert.equal(result.data.dimensions.warmth.high.adherence, 0.82);
  assert.equal(result.data.dimensions.warmth.high.calibrated, true);
  assert.equal(
    result.data.interactions["warmth-high_directness-high"].pattern,
    "interaction update"
  );
  assert.equal(
    result.data.interactions["warmth-high_directness-high"].adherence,
    0.76
  );
});

test("mergeCalibrationFile updates pattern file in place", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "traits-calibration-"));
  const filePath = path.join(tmpDir, "patterns.json");
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        version: "test",
        dimensions: {},
        interactions: {}
      },
      null,
      2
    ),
    "utf8"
  );

  try {
    const summary = mergeCalibrationFile(filePath, {
      dimensions: [{ dimension: "formality", level: "high", pattern: "updated", adherence: 0.9 }]
    });
    assert.equal(summary.dimension_updates, 1);
    const updated = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.equal(updated.dimensions.formality.high.pattern, "updated");
    assert.equal(updated.dimensions.formality.high.calibrated, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
