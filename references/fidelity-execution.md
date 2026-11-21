# v6.4 Evidence-driven fidelity execution

Product QA is separate from the hidden v6.3.3 benchmark evaluator.
The agent uses authenticated read-only Figma **visible UI**, not Figma API/MCP/plugins.

## Mandatory workflow

1. Inspect the full Figma region inventory, each parent/order/required status and direct evidence hashes. Run `scripts/fidelity/inventory.mjs`.
2. Call `scripts/fidelity/run.mjs init`, then `observe` using the verified inventory artifact.
3. Capture actual Vue runtime in Chromium. Use `capture`, not a source-only or fixture report.
4. Perform full DOM discovery and compare missing/extra/ambiguous regions; invoke `map` and `detect`.
5. For each P0/P1 issue, use actual CSS evidence, create small patch plan, then call `diagnose`, `patch`, `verify`.
6. Patch verification requires fresh same-scope runtime and parent/sibling/global regression checks; rejected patch must be restored before `REVERTED`.
7. Repeat with `next` until all blocking issues disappear. Require independently performed Figma re-inspection and latest runtime evidence for `review` and `done`.

The controller rejects invalid state transitions, stale detection hashes, repeated failed patch hashes and missing independent reviewer.
It cannot itself prove that host-supplied evidence came from real Figma/browser: host capability evidence and privacy-safe audit remain necessary.

## Initial controller example

```bash
node scripts/fidelity/run.mjs init --workspace .design-qa/fidelity --config PRIVATE/run-config.json
node scripts/fidelity/inventory.mjs --input PRIVATE/figma-inventory.json --evidence-root PRIVATE --out .design-qa/fidelity/figma-verified.json
node scripts/fidelity/run.mjs observe --workspace .design-qa/fidelity --artifact .design-qa/fidelity/figma-verified.json
```

Do not give hidden benchmark Gold to the developer agent. Explicit failures are PARTIAL/BLOCKED, never automatic PASS.

v6.4.0 implements the evidence controller. DOM discovery, CSS tracing and reversible patch tooling are staged in later v6.4 PRs.
