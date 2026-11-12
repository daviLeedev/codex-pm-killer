# Review record — Algolia Mobile Home v6.3 benchmark (2026-11-12)

**Evidence type:** analysis of the user-supplied private report bundle, not a new live Figma attestation. No API requests were made by this review. The source bundle SHA-256 is preserved in [the anonymized experiment entry](2026-11-12-algolia-home-v6.3.json); private raw evidence is not stored in this public repository.

## Frozen observations (v6.3.0)

| Group | MATCH | MISMATCH | NOT_EVALUABLE | Evaluability | Usage-based estimated USD |
|---|---:|---:|---:|---:|---:|
| A — no skill | 113 | 16 | 21 | 86% | 0.4675355 |
| B — single model + skill | 133 | 11 | 6 | 96% nominal | 0.5835480 |
| C — role-separated + skill | 135 | 9 | 6 | 96% nominal | 1.3814105 |

These scores have a fixed 150-assertion denominator and are **not revised after the patch**. C used host-mediated sequential roles, not independently spawned browser-capable subagents. The experiment had one run per group (n=1), so it is exploratory. The report estimates 14 API requests and $2.432494 total across A/B/C; these values are not independently verified invoices.

## Review findings and dispositions

| Finding | Impact on original score | v6.3.1 disposition | Outstanding work |
|---|---|---|---|
| Search input placeholder text captured from empty `innerText` | Can create a false MISMATCH | Runtime now records actual placeholder and displayed input text | Re-capture the same Home and rescore against frozen truth |
| Search `::placeholder` text color not collected | May compare the input's normal color to a placeholder | Runtime now records pseudo-element color and evaluator supports explicit placeholder assertions | Obtain direct Figma placeholder color evidence |
| Block elements compared using default `flexDirection:row` | False horizontal gap MISMATCH in vertical layout | Block/flex/grid rendered-axis rules and focused regressions added | Re-capture actual DOM; do not overwrite previous scores |
| Photos represented by simple vector art | Significant visual-fidelity mismatch not proven by geometry | Optional raster/vector/placeholder asset class assertion | Exact Figma asset and visual similarity still require dedicated validation |
| Model role segmentation with large repeated context | C cost > B; no proven general multi-agent benefit | Existing context policies retained | Repeat tests with actual per-role token accounting |
| Host execution budget raised to $10 after $5 user request | Approval-policy discrepancy, though estimated spend remained under $5 | Separate approved-cap vs ledger consistency checker | Require authentic human approval record, provider billing remains external |

## What is actually validated

- Source-level evaluator and collector patch with synthetic geometry, placeholder, asset-type and historical policy tests.
- No new live browser capture / Figma audit / A-B-C benchmark run in this patch.
- The target **trustworthy ≥95% evaluability** remains unproven; nominal v6.3 96% is not accepted as that goal.
- The historic record is not evidence that v6.3.1 reduced cost or improved measured real-world accuracy.

## Follow-up acceptance

1. Reuse original frozen 150 assertions and viewport, with verified Figma evidence where available.
2. Re-capture the **same** A/B/C Vue implementations using v6.3.1 runtime collector and rerun the evaluator. Save results under a **new** run ID.
3. Recheck typography, real photo/assets and actual line wraps independently; compare before/after assertion IDs, not totals alone.
4. Require original $5 user-approved combined budget and explicit authorizing record before further paid execution.
5. Publish only sanitized aggregate statistics and a new review record; retain Figma, browser, raw API and original source privately.

**Conclusion:** the code corrects known classes of evaluation errors, but the previous frozen scores are not upgraded by inference and the next live benchmark remains necessary.
