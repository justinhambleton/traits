import fs from "node:fs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  if (!Array.isArray(value)) return [];
  return value;
}

export function applyCalibrationUpdates(patternData, updates) {
  const next = clone(patternData ?? {});
  next.dimensions = next.dimensions ?? {};
  next.interactions = next.interactions ?? {};

  let dimensionUpdates = 0;
  let interactionUpdates = 0;

  for (const update of asArray(updates?.dimensions)) {
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

  for (const update of asArray(updates?.interactions)) {
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

export function mergeCalibrationFile(patternFilePath, updates) {
  const current = JSON.parse(fs.readFileSync(patternFilePath, "utf8"));
  const merged = applyCalibrationUpdates(current, updates);
  fs.writeFileSync(patternFilePath, `${JSON.stringify(merged.data, null, 2)}\n`, "utf8");
  return merged.summary;
}
