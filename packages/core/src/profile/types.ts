import type { ContextAdaptation } from "../types.js";

export type GenericObject = Record<string, unknown>;

export type ContextWithPriority = ContextAdaptation & {
  _index: number;
  _priority: number;
};

export type ResolveOptions = {
  bundledProfilesDir?: string;
};
