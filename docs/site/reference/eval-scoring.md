# Eval Scoring Reference

Technical reference for the scoring algorithms behind `traits eval`. For usage guidance, see [Running Evaluations](/guides/running-evaluations).

## Tier 1 composite score

```
score = (W_preferred × preferred_coverage
       + W_forbidden × (1 − forbidden_penalty)
       + W_dimensions × dimension_alignment
       + W_helpfulness × helpfulness_score) / total_weight
```

### Weights

| Component | Weight | With `--no-helpfulness` |
|-----------|--------|------------------------|
| Preferred term coverage | 0.25 | 0.25 |
| Forbidden term penalty | 0.20 | 0.20 |
| Dimension alignment | 0.40 | 0.40 |
| Helpfulness | 0.15 | 0 (excluded) |
| **Total** | **1.00** | **0.85** (renormalized) |

When `--no-helpfulness` is set, the total weight becomes 0.85 and the score is divided by that sum, effectively redistributing the helpfulness weight proportionally.

---

## Preferred term coverage

For each preferred term:

1. Extract significant words (exclude stopwords: a, an, the, is, it, to, i, you, that)
2. Check how many significant words appear in the response
3. Single-word terms: 1.0 if present, 0.0 if absent
4. Multi-word terms: `matched_words / total_significant_words`
5. A term counts as "matched" if its coverage ≥ 0.5

```
preferred_coverage = sum(per_term_coverage) / total_preferred_terms
```

If no preferred terms are defined, coverage defaults to 1.0.

## Forbidden term penalty

Exact case-insensitive substring matching against each forbidden term.

```
forbidden_penalty = forbidden_matches / total_forbidden_terms
component_score = 1 − forbidden_penalty
```

A single match against 5 total forbidden terms: penalty = 0.2, component score = 0.8.

Zero forbidden terms defined: penalty = 0, component score = 1.0.

## Helpfulness

Binary threshold at 40 characters (trimmed response).

```
if char_count >= 40: helpfulness = 1.0
if char_count < 40:  helpfulness = char_count / 40
```

Skip with `--no-helpfulness`. When skipped, this component is excluded from the weighted sum.

---

## Dimension alignment

Six dimensions evaluated independently, then averaged:

```
dimension_alignment = mean(formality, warmth, verbosity, directness, empathy, humor)
```

### Signal-based scoring formula

Used by formality, warmth, directness, and empathy:

```
score = aligned / (aligned + counter + 1)
```

- `aligned`: count of signal phrases matching the target direction
- `counter`: count of signal phrases opposing the target direction
- The `+1` denominator bias prevents division by zero and returns 0 for responses with no signals (rather than an undefined ratio)

### Signal direction by target level

| Target | Aligned signals | Counter signals |
|--------|----------------|-----------------|
| `high` / `very-high` | High-set phrases | Low-set phrases |
| `low` / `very-low` | Low-set phrases | High-set phrases |
| `medium` | 0.5 × (high + low) | 0.5 × \|high − low\| |

For `medium` targets, balance is rewarded: equal high and low signals produce aligned = total, counter = 0.

---

## Signal phrase sets

### Warmth

| Direction | Phrases |
|-----------|---------|
| High | "i understand", "i hear you", "that must be", "i appreciate", "it makes sense", "you are not alone", "i'm sorry to hear", "thank you for sharing", "i can see why", "completely understandable", "that sounds difficult", "i know this is hard" |
| Low | "per the documentation", "as stated", "the correct approach", "refer to", "in accordance with", "as specified", "follow policy", "procedure requires", "compliance requires", "see section" |

### Empathy

| Direction | Phrases |
|-----------|---------|
| High | "i can imagine", "that is understandable", "it's natural to feel", "your feelings", "that sounds", "i recognize", "valid concern", "it's okay to", "makes complete sense", "i can see this is stressful", "you are dealing with", "thanks for being honest" |
| Low | "objectively", "regardless", "the fact is", "irrespective of", "notwithstanding", "strictly speaking", "from a detached perspective", "emotion aside" |

### Directness

| Direction | Phrases |
|-----------|---------|
| High | Imperative sentence starts (check, start, run, set, review, verify, follow, etc.), "here's what", "do this", "the answer is", "start by", "first,", "step 1", "check", "next,", "then," |
| Low | "perhaps", "you might consider", "it could be", "one possibility", "there are many ways", "it depends", "potentially", "if you prefer", "you may wish to", "you could try" |

Directness also counts imperative sentence starts — sentences beginning with action verbs (optionally preceded by "please") or step markers ("First,", "Step 1,", "Next,").

### Formality

| Direction | Phrases |
|-----------|---------|
| High | "therefore", "consequently", "with regard to", "i would recommend", "please note that", "it is important", "furthermore", "in summary", "in addition", "to clarify" |
| Low | "i'm", "you're", "don't", "can't", "won't", "it's", "hey", "sure thing", "yeah", "cool", "awesome", "no worries" |

---

## Verbosity scoring

Verbosity uses character-count proximity curves instead of phrase signals.

### Target ranges

| Target | Full score (1.0) | Zero score (0.0) | Transition |
|--------|-----------------|-------------------|------------|
| `very-low` / `low` | ≤ 300 chars | ≥ 900 chars | Linear decay 300→900 |
| `medium` | 200–800 chars | ≥ 1600 chars | Linear ramp 0→200, linear decay 800→1600 |
| `high` / `very-high` | ≥ 400 chars | ≤ 80 chars | Linear ramp 80→400 |

### Proximity to signal conversion

The proximity value (0–1) is converted to aligned/counter signals for the standard formula:

```
aligned = proximity × 6
counter = (1 − proximity) × 2
score = aligned / (aligned + counter + 1)
```

At full proximity (1.0): aligned = 6, counter = 0, score = 6/7 ≈ 0.857.
At zero proximity (0.0): aligned = 0, counter = 2, score = 0/3 = 0.

---

## Humor scoring

Humor uses keyword and punctuation detection rather than directional phrase sets.

### Signal detection

| Signal | Rule |
|--------|------|
| Exclamation density | > 2 exclamation marks: 1 hit + 1 per additional 3 |
| Laughter patterns | `haha`, `ha!`, `lol`, `lmao` → 1 hit |
| Humor keywords | `funny`, `joke`, `hilarious`, `playful` → 1 hit |
| Tag questions | `? right`, `? yeah`, `? eh` → 1 hit |
| Exclamatory words | `awesome`, `wow`, `yay`, `yikes` → 1 hit (case-insensitive in lowered text); also `heck` |

### Scoring by target

| Target | Aligned | Counter |
|--------|---------|---------|
| `very-low` / `low` | 6 if hits = 0, else 1 | hits |
| `medium` | 4 if 1 ≤ hits ≤ 2, else 1 | 1 if hits = 0, else max(0, hits − 2) |
| `high` / `very-high` | hits + 2 | 3 if hits = 0, else 0 |

All values are passed through `score = aligned / (aligned + counter + 1)`.

---

## Tier 2 scoring

Tier 2 computes cosine similarity between the response embedding and reference embeddings for each voice dimension target. The embedding model defaults to OpenAI's `text-embedding-3-small`.

Override with `--embedding-model`.

Requires `TRAITS_OPENAI_API_KEY`.

## Tier 3 scoring

Tier 3 sends the compiled system prompt, the user prompt, and the response to a judge model. The judge receives an adherence rubric derived from the profile policy and scores each dimension on [0, 1].

| Option | Default |
|--------|---------|
| Provider | `auto` (selects by available key) |
| Judge model | Provider default |
| Timeout | 20000 ms |
| Retries | 2 |

Override with `--provider`, `--judge-model`, `--timeout-ms`, `--max-retries`.

Requires `TRAITS_OPENAI_API_KEY` or `TRAITS_ANTHROPIC_API_KEY`.

---

## Calibration baselines

The knowledge base includes empirical adherence scores from offline calibration runs (20 scenarios per model). These scores appear in `knowledge-base/{model}/patterns.json` and represent the expected Tier 1 score when using that pattern.

Example baseline scores (Claude):

| Dimension | Level | Adherence |
|-----------|-------|-----------|
| Formality | very-low | 0.719 |
| Formality | medium | 0.720 |
| Formality | very-high | 0.722 |
| Warmth | high | 0.728 |
| Directness | high | 0.731 |

When `traits eval` runs with baselines enabled (default), it compares your profile's scores against a generic scaffold compiled without personality policy. The delta shows how much your policy improves adherence over a bare prompt.

Disable baseline comparison with `--no-baselines`.
