# Running Evaluations

Score agent responses against profile policy. Three tiers trade speed for fidelity.

## Tier overview

| Tier | Method | Latency | API key required | Best for |
|------|--------|---------|------------------|----------|
| 1 | Deterministic signals | < 10 ms | No | CI gates, fast regression |
| 2 | Embedding similarity | ~200 ms | `TRAITS_OPENAI_API_KEY` | Directional style signal |
| 3 | LLM judge rubric | ~2 s | OpenAI or Anthropic | Highest-fidelity adherence |

Missing credentials downgrade execution to available tiers instead of failing.

## Tier 1 scoring

Tier 1 is the primary CI gate. It runs locally in milliseconds with no API keys.

### Composite formula

```
score = (0.25 × preferred_coverage
       + 0.20 × (1 − forbidden_penalty)
       + 0.40 × dimension_alignment
       + 0.15 × helpfulness)
```

When `--no-helpfulness` is set, the helpfulness weight drops to 0 and the remaining weights are renormalized.

### Component breakdown

**Preferred term coverage** (weight 0.25)

For each preferred term, the scorer extracts significant words (excluding stopwords) and checks how many appear in the response. Multi-word terms use partial coverage: a term scores 1.0 if all significant words match, 0.5 if half match. A term counts as "matched" when its coverage reaches 0.5 or higher. The final coverage is the mean across all terms. If no preferred terms are defined, coverage defaults to 1.0.

**Forbidden term penalty** (weight 0.20)

Exact substring match against each forbidden term. The penalty is `matches / total_forbidden_terms`. A single forbidden term hit drops this component from 1.0 toward 0.0. Zero forbidden terms defined means no penalty (1.0).

**Dimension alignment** (weight 0.40)

Each of the six voice dimensions is scored independently, then averaged. See [Dimension scoring](#dimension-scoring) below.

**Helpfulness** (weight 0.15)

Binary pass at 40 characters. Responses shorter than 40 characters score proportionally: `min(1, char_count / 40)`. Skip with `--no-helpfulness`.

### Dimension scoring

Six dimensions are evaluated: formality, warmth, verbosity, directness, empathy, humor.

Each dimension uses the signal-based formula:

```
score = aligned / (aligned + counter + 1)
```

Where `aligned` is the count of signals matching the target direction, and `counter` is the count of signals opposing it. The `+1` in the denominator prevents division by zero and biases short responses toward 0 rather than 1.

**Signal-based dimensions** (formality, warmth, directness, empathy)

Each dimension has a high-signal set and a low-signal set — phrase patterns detected via substring match. When the target is `high` or `very-high`, high-signal hits are aligned and low-signal hits are counter. When the target is `low` or `very-low`, the roles reverse. For `medium`, both signal directions contribute equally as aligned, while the absolute imbalance between them contributes as counter.

Example signal phrases:

| Dimension | High signals (subset) | Low signals (subset) |
|-----------|----------------------|---------------------|
| Warmth | "i understand", "i hear you", "that must be" | "per the documentation", "as stated", "refer to" |
| Directness | "here's what", "do this", "start by" | "perhaps", "you might consider", "it could be" |
| Formality | "therefore", "consequently", "please note that" | "don't", "can't", "hey", "no worries" |
| Empathy | "i can imagine", "that is understandable", "valid concern" | "objectively", "regardless", "the fact is" |

Directness also counts imperative sentence starts (e.g., "Check your settings", "Step 1, ...") as high-direction signals.

**Verbosity** — character-count proximity curves

Verbosity does not use phrase signals. Instead it measures how close the response character count is to the target range:

| Target | Full score (1.0) | Zero score (0.0) | Decay |
|--------|-----------------|-------------------|-------|
| `very-low` / `low` | ≤ 300 chars | ≥ 900 chars | Linear from 300–900 |
| `medium` | 200–800 chars | < 0 or ≥ 1600 chars | Linear ramp-up below 200, linear decay 800–1600 |
| `high` / `very-high` | ≥ 400 chars | ≤ 80 chars | Linear from 80–400 |

The proximity value is converted to aligned/counter signals: `aligned = proximity × 6`, `counter = (1 − proximity) × 2`, then passed through the standard `scoreFromSignals` formula.

**Humor** — keyword and punctuation detection

Humor signals are detected by:
- Exclamation marks: > 2 exclamations scores 1 hit + 1 per additional 3
- Laughter patterns: `haha`, `ha!`, `lol`, `lmao`
- Humor keywords: `funny`, `joke`, `hilarious`, `playful`
- Tag questions: `? right`, `? yeah`, `? eh`
- Exclamatory words: `awesome`, `wow`, `yay`, `yikes`

Low-humor targets (`very-low`/`low`) reward zero hits. Medium targets reward 1–2 hits. High targets reward more hits and penalize zero.

## Tier 2: Embedding similarity

Tier 2 computes cosine similarity between the response embedding and reference embeddings for each voice dimension target. It provides a directional style signal.

Requires `TRAITS_OPENAI_API_KEY` for embeddings. Override the embedding model with `--embedding-model`.

Tier 2 is directionally useful but not deterministic — do not use it as a sole merge gate.

## Tier 3: LLM judge

Tier 3 sends the compiled system prompt, user prompt, and response to a judge model with an adherence rubric derived from the profile policy. The judge scores each dimension and provides reasoning.

Requires `TRAITS_OPENAI_API_KEY` or `TRAITS_ANTHROPIC_API_KEY`. Select provider with `--provider openai|anthropic`. Override the judge model with `--judge-model`.

Tier 3 is the highest-fidelity signal but is non-deterministic and expensive. Do not use Tier 3 alone as a merge gate.

## Built-in suites

Five baseline suites provide pre-written evaluation samples by domain:

| Suite | Domain | Use with |
|-------|--------|----------|
| `support` | Customer support | resolve profile |
| `healthcare` | Healthcare communication | haven profile |
| `developer` | Developer experience | architect profile |
| `educator` | Teaching and instruction | educator profile |
| `advisor` | Advisory and consulting | advisor profile |

```bash
traits eval my-agent.yaml --model gpt-4o --suite support
```

## Baseline comparison

By default, `traits eval` compares your compiled profile's scores against a generic scaffold (the profile compiled without any personality policy). The delta shows how much your policy improves adherence over a bare prompt. Disable with `--no-baselines`.

## Output formats

**Text** (default) — human-readable summary with per-sample scores.

**JSON** (`--json` or `--format json`) — structured output for programmatic consumption. Includes per-sample checks, per-dimension breakdowns, and aggregate scores.

**JUnit** (`--format junit`) — XML for CI systems. Each tier is a test suite, each sample is a test case. Failures are controlled by threshold flags:

```bash
# Global threshold (all tiers)
traits eval my-agent.yaml --model gpt-4o --format junit --junit-threshold 0.8

# Per-tier thresholds
traits eval my-agent.yaml --model gpt-4o --format junit \
  --junit-threshold-tier1 0.85 \
  --junit-threshold-tier2 0.7 \
  --junit-threshold-tier3 0.6
```

Default threshold: 0.7. Exit code 1 when any sample falls below.

## CI recommendation

```
PR merge gate:
  └─ Tier 1 required (fast, deterministic, no credentials)
       └─ Fail if score < 0.7 (or your calibrated threshold)

Release candidate:
  └─ Tier 1 + Tier 2 + Tier 3
       └─ Investigate deltas, do not hard-gate on Tier 2/3 alone

Scheduled regression:
  └─ Full suite nightly with JUnit output
       └─ Alert on Tier 1 regression, review Tier 2/3 drift
```

### GitHub Actions example

```yaml
- name: Eval policy adherence
  run: |
    npx traits eval my-agent.yaml --model gpt-4o \
      --suite support --format junit \
      --junit-threshold 0.8 > eval-results.xml

- name: Publish results
  uses: mikepenz/action-junit-report@v4
  if: always()
  with:
    report_paths: eval-results.xml
```

## CLI quick reference

```bash
# Tier 1 only — local, no API keys
traits eval my-agent.yaml --model gpt-4o \
  --response "I understand. Let me resolve this now."

# From a samples file
traits eval my-agent.yaml --model gpt-4o --samples eval-samples.json

# Built-in suite with JUnit output
traits eval my-agent.yaml --model gpt-4o --suite support --format junit

# All tiers with JSON output
TRAITS_OPENAI_API_KEY=sk-... \
  traits eval my-agent.yaml --model gpt-4o --tier 3 --json
```

See the full [CLI Reference](/reference/cli) for all flags and exit codes.
