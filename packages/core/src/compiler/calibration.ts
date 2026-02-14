import fs from "node:fs";
import { asArray, clone } from "../utils.js";

type CalibrationUpdateItem = {
  dimension?: string;
  level?: string;
  id?: string;
  pattern?: string;
  adherence?: number;
};

type CalibrationUpdates = {
  dimensions?: CalibrationUpdateItem[];
  interactions?: CalibrationUpdateItem[];
};

type PatternFileData = {
  dimensions?: Record<string, Record<string, Record<string, unknown>>>;
  interactions?: Record<string, Record<string, unknown>>;
  updated_at?: string;
  [key: string]: unknown;
};

export function applyCalibrationUpdates(
  patternData: PatternFileData,
  updates: CalibrationUpdates
): {
  data: PatternFileData;
  summary: { dimension_updates: number; interaction_updates: number };
} {
  const next = clone(patternData ?? {}) as PatternFileData;
  next.dimensions = next.dimensions ?? {};
  next.interactions = next.interactions ?? {};

  let dimensionUpdates = 0;
  let interactionUpdates = 0;

  for (const update of asArray<CalibrationUpdateItem>(updates?.dimensions)) {
    if (!update?.dimension || !update?.level) continue;
    const dimension = String(update.dimension);
    const level = String(update.level);
    next.dimensions[dimension] = next.dimensions[dimension] ?? {};
    next.dimensions[dimension][level] = next.dimensions[dimension][level] ?? {};
    if (update.pattern != null) {
      next.dimensions[dimension][level].pattern = String(update.pattern);
    }
    if (update.adherence != null) {
      next.dimensions[dimension][level].adherence = Number(update.adherence);
    }
    next.dimensions[dimension][level].calibrated = true;
    dimensionUpdates += 1;
  }

  for (const update of asArray<CalibrationUpdateItem>(updates?.interactions)) {
    if (!update?.id) continue;
    const id = String(update.id);
    next.interactions[id] = next.interactions[id] ?? {};
    if (update.pattern != null) {
      next.interactions[id].pattern = String(update.pattern);
    }
    if (update.adherence != null) {
      next.interactions[id].adherence = Number(update.adherence);
    }
    next.interactions[id].calibrated = true;
    interactionUpdates += 1;
  }

  next.updated_at = new Date().toISOString();
  return {
    data: next,
    summary: {
      dimension_updates: dimensionUpdates,
      interaction_updates: interactionUpdates
    }
  };
}

export function mergeCalibrationFile(
  patternFilePath: string,
  updates: CalibrationUpdates
): { dimension_updates: number; interaction_updates: number } {
  const current = JSON.parse(fs.readFileSync(patternFilePath, "utf8")) as PatternFileData;
  const merged = applyCalibrationUpdates(current, updates);
  fs.writeFileSync(patternFilePath, `${JSON.stringify(merged.data, null, 2)}\n`, "utf8");
  return merged.summary;
}
