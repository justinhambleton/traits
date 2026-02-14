import type { ContextAdaptation } from "../types.js";

export const SAFETY_ADAPTATION_NAME = /(crisis|emergency|harm|suicid|self[-_ ]?harm)/i;

export type GenericObject = Record<string, unknown>;

export type ContextWithPriority = ContextAdaptation & {
  _index: number;
  _priority: number;
};

export type ResolveOptions = {
  bundledProfilesDir?: string;
};
