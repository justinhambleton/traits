import type { DimensionName } from "../types.js";

type SignalMatcher = string | RegExp | ((text: string) => number);

type DimensionSignalSet = {
  high: SignalMatcher[];
  low: SignalMatcher[];
};

function countImperativeSentenceStarts(text: string): number {
  const imperativeVerbs = [
    "start",
    "check",
    "do",
    "use",
    "open",
    "run",
    "set",
    "review",
    "verify",
    "follow",
    "take",
    "stop",
    "restart",
    "install",
    "update"
  ];
  const sentences = String(text ?? "")
    .split(/[.!?\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  let hits = 0;
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase();
    const directMatch = imperativeVerbs.some((verb) =>
      normalized.match(new RegExp(`^(please\\s+)?${verb}\\b`))
    );
    const stepMatch = normalized.match(/^(first|step\s*\d+|next),?\s+/);
    if (directMatch || stepMatch) hits += 1;
  }
  return hits;
}

const DIMENSION_SIGNALS: Record<"warmth" | "empathy" | "directness" | "formality", DimensionSignalSet> = {
  warmth: {
    high: [
      "i understand",
      "i hear you",
      "that must be",
      "i appreciate",
      "it makes sense",
      "you are not alone",
      "i'm sorry to hear",
      "thank you for sharing",
      "i can see why",
      "completely understandable",
      "that sounds difficult",
      "i know this is hard"
    ],
    low: [
      "per the documentation",
      "as stated",
      "the correct approach",
      "refer to",
      "in accordance with",
      "as specified",
      "follow policy",
      "procedure requires",
      "compliance requires",
      "see section"
    ]
  },
  empathy: {
    high: [
      "i can imagine",
      "that is understandable",
      "it's natural to feel",
      "your feelings",
      "that sounds",
      "i recognize",
      "valid concern",
      "it's okay to",
      "makes complete sense",
      "i can see this is stressful",
      "you are dealing with",
      "thanks for being honest"
    ],
    low: [
      "objectively",
      "regardless",
      "the fact is",
      "irrespective of",
      "notwithstanding",
      "strictly speaking",
      "from a detached perspective",
      "emotion aside"
    ]
  },
  directness: {
    high: [
      (text) => countImperativeSentenceStarts(text),
      "here's what",
      "do this",
      "the answer is",
      "start by",
      "first,",
      "step 1",
      "check",
      "next,",
      "then,"
    ],
    low: [
      "perhaps",
      "you might consider",
      "it could be",
      "one possibility",
      "there are many ways",
      "it depends",
      "potentially",
      "if you prefer",
      "you may wish to",
      "you could try"
    ]
  },
  formality: {
    high: [
      "therefore",
      "consequently",
      "with regard to",
      "i would recommend",
      "please note that",
      "it is important",
      "furthermore",
      "in summary",
      "in addition",
      "to clarify"
    ],
    low: [
      "i'm",
      "you're",
      "don't",
      "can't",
      "won't",
      "it's",
      "hey",
      "sure thing",
      "yeah",
      "cool",
      "awesome",
      "no worries"
    ]
  }
};

function countSignal(text: string, matcher: SignalMatcher): number {
  const source = String(text ?? "");
  const lowered = source.toLowerCase();
  if (typeof matcher === "string") {
    return lowered.includes(matcher.toLowerCase()) ? 1 : 0;
  }
  if (matcher instanceof RegExp) {
    return matcher.test(source) ? 1 : 0;
  }
  return Number(matcher(source) || 0);
}

export function countSignalHits(text: string, signals: SignalMatcher[]): number {
  let hits = 0;
  for (const signal of signals) {
    hits += countSignal(text, signal);
  }
  return hits;
}

export function getDimensionSignalSet(dimension: DimensionName): DimensionSignalSet | null {
  if (
    dimension === "warmth" ||
    dimension === "empathy" ||
    dimension === "directness" ||
    dimension === "formality"
  ) {
    return DIMENSION_SIGNALS[dimension];
  }
  return null;
}

export function countHumorSignalHits(text: string): number {
  const source = String(text ?? "");
  const lowered = source.toLowerCase();
  let hits = 0;

  const exclamations = (source.match(/!/g) ?? []).length;
  if (exclamations > 2) {
    hits += 1 + Math.floor((exclamations - 3) / 3);
  }
  if (/\b(haha+|ha!|lol|lmao)\b/i.test(source)) hits += 1;
  if (/\b(funny|joke|hilarious|playful)\b/i.test(source)) hits += 1;
  if (/\?\s*(right|yeah|eh)\b/i.test(source)) hits += 1;
  if (/\b(awesome|wow|yay|heck|yikes)\b/i.test(lowered)) hits += 1;

  return hits;
}
