# v6.3 — Benchmark Reliability & Visual Fidelity

Portable **offline benchmarking tools** for reproducible Figma → local DOM fidelity checks and OpenAI/Claude/Gemini model-agnostic token-cost accounting.

## Implemented components

| File | Role |
|---|---|
| `freeze-truth.mjs` | Freeze assertion count, expected JSON SHA-256, per-property distribution, direct evidence hash status; refuses to certify missing Figma proof |
| `capture-runtime.mjs` | Playwright local-app-only scoped DOM capture with computed typography, colors, in-flow child rectangles, visible text/icons/images, overflow and screenshots; does **not** read Figma |
| `evaluate.mjs` | Inspect frozen expected vs runtime facts; geometry/spacing, fill/color, font, text, radius, child counts, icons and images; output MATCH/MISMATCH/NOT_EVALUABLE per assertion |
| `budget-journal.mjs` | $5 default budget, pre-request reservation, durable raw-response journal, crash inspection, settlement, uncertain-charge blocking; **no API calls** |
| `tests/v6.3-selftest.mjs` | 20 independent synthetic mutations + 20 clean controls; validator coverage/false PASS checks |
| `tests/v6.3-budget-selftest.mjs` | 20 CLI assertions including durable raw preservation and blocking unclear charges |

## Workflow

1. Select **one** mobile Home Figma frame and directly inspect the read-only Layers + Properties UI. Capture actual evidence and sha256 into a PRIVATE app workspace. No MCP/API/plugin.
2. Freeze a truth file (schema compatible with legacy `layers[].checks[]`) and lock the 150 legacy assertions **before** A/B/C begins:

```bash
node /path/to/skill/benchmarks/v6.3/freeze-truth.mjs --expected .design-qa/gold.json --out .design-qa/gold-lock.json --evidence-root "$PWD" --legacy-count 150
```

3. Provide a verified mapping of actual app selectors in `mapping.json`, e.g. `{"regions":[{"id":"L00","selector":"[data-design-qa=\"home\"]"}]}`. Playwright is required in the **app project**.

```bash
node /path/to/skill/benchmarks/v6.3/capture-runtime.mjs --url http://localhost:5173 --mapping .design-qa/mapping.json --out .design-qa/dom-facts.json --width 375 --height 1069
node /path/to/skill/benchmarks/v6.3/evaluate.mjs --expected .design-qa/gold.json --expected-sha256 SHA_FROM_GOLD_LOCK --actual .design-qa/dom-facts.json --out .design-qa/quality-report.json --evidence-root "$PWD"
```

4. Report all denominator counts: **MATCH, MISMATCH, NOT_EVALUABLE**; evaluable coverage, observed match ratio, total verified ratio and critical unknowns. Do not claim pixel-perfect from DOM only; icons validated as present are not proof of SVG visual contour fidelity.
5. For live API benchmarking use an external runner; call this journal **before sending requests** and **immediately after receiving responses**:

```bash
JOURNAL=/path/to/skill/benchmarks/v6.3/budget-journal.mjs
node "$JOURNAL" init --dir .design-qa/api-budget --cap-usd 5.000000
node "$JOURNAL" reserve --dir .design-qa/api-budget --request-id REQUEST-0001 --model YOUR_MODEL --max-usd 0.200000
# Host safely makes one provider request and writes the full raw response to PRIVATE /tmp/response-0001.json
node "$JOURNAL" record-response --dir .design-qa/api-budget --request-id REQUEST-0001 --response-file /tmp/response-0001.json
# Host independently derives a cost estimate from authentic usage and the current price list.
node "$JOURNAL" settle --dir .design-qa/api-budget --request-id REQUEST-0001 --actual-usd 0.014500 --usage-file /tmp/usage-0001.json
node "$JOURNAL" status --dir .design-qa/api-budget
```

**Crash caution:** An interrupted request may have been charged even without a response. `recover` never resends and leaves uncertain or unpriced requests blocked. This is a **software** reservation, not a financial guarantee; provider limits and real billing must still be independently checked. Protect `.design-qa` and raw output. Do not store API keys in response files.

## Evidence caveat from the previous Algolia test

The previously supplied `actual-evaluation-frozen.json` has exactly 150 assertions but lacks direct per-assertion source/hashes. `freeze-truth.mjs` therefore reports **150 UNKNOWN and PARTIAL**. This is intentional; no automatic upgrading to 95% coverage without actually collecting Figma truth. New property support is validated by synthetic mutation tests, not by asserting Figma was accessed.

## Benchmark policy

See `references/v6.3-benchmark-protocol.md` for Track I implementation fidelity vs Track II independent mutation QA. All A/B/C experiments share a pre-frozen ground truth, same initial app conditions and combined approved $5 budget. A/B same model/config; C must state whether real subagents spawned or host mediated sequential contexts. `n=1` is exploratory only.


## v6.3.1 corrections

- Local input/textarea capture now records `placeholderText`, `placeholderColor`, `placeholderVisible`; visible input text uses entered value or placeholder. For design placeholder text use `placeholder_text`, for its color `placeholder_color`, or `color` when placeholderVisible is explicitly captured.
- Rendered `gap` is measured from actual child rectangles and layout type. Block/flow-root uses vertical edges (ignoring computed default flexDirection); flex follows its real direction and track; grid needs assertion `axis: 'row' | 'column'`. Ambiguous axes return `NOT_EVALUABLE` instead of fake matches.
- Optional `asset_kind: 'raster_photo' | 'vector' | 'placeholder' | 'other_image' | 'none'` check detects broad substitutions; identical class does not mean pixel-perfect image fidelity.
- An element without a measurable HTML image no longer automatically reports a failed `image_loaded` assertion; it is unverified.
- For the originally approved combined A/B/C budget, run `verify-approved-budget.mjs` with a **private** approval declaration and the v6.3 journal. Its authorization reference is not independently authenticated by the script.
- Run-specific summary records live in `benchmarks/history/`. Never put private Figma captures or API raw response into this public repository.

**Do not silently reclassify the Nov 12 v6.3 frozen A/B/C scores.** v6.3.1 requires a new capture and a new result ID for a defensible updated measurement. See `references/v6.3.1-patch-protocol.md`.
