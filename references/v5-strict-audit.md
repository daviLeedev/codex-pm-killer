# v5 Strict Audit — inventory → review → measure → independent re-inspection → gate

## Scope and limitations

- The Figma UI is **view only**, navigated via the currently authenticated Codex in-app browser. **No Figma API/MCP/plugin/Dev Mode**.
- **No automated layer-tree extraction is claimed**. The agent MUST create `figma-inventory.json` by traversing the visible Layers + Properties panels, saving screenshots of each selected element and expanded branch. If a branch is inaccessible or not visited, `coverage.status=PARTIAL`. The evaluator cannot prove an agent's self-reported completeness or screenshot provenance.
- Local DOM inventory is mechanically created from a real Playwright capture; map suggestions **are not confirmations**. Each approved pairing requires direct human/agent review and evidence of the selected Figma region and corresponding real-app DOM.
- Do not publish Figma screenshots, internal client text, routes or customer evidence to this shared GitHub repository. `.design-qa` stays in the application workspace.

## Step 0: run old v4 audit and knowledge lookup

Read `SKILL.md`, `references/region-dom-audit.md`, and `references/knowledge-loop.md`. Preserve v4 region mapping and layout checks. Run all v4 tests; don't relax prior PASS thresholds. Select one Figma frame, actual app route, equivalent viewport and baseline strings. Note any blocked viewer access explicitly.

## Step 1: get complete local DOM snapshot

```bash
node <skill-dir>/scripts/capture-local.mjs --url http://localhost:5173/terms --out .design-qa/terms/render --width 400 --height 844 --limit 20000
node <skill-dir>/scripts/v5-audit.mjs inventory --snapshot .design-qa/terms/render/layout.json --out .design-qa/terms/dom-inventory.json
```

If either command fails or snapshot reports `truncated`, capture by scoped app sub-regions using `--selector`, run per-scope inventories, and **mark entire page PARTIAL until coverage reconciles**. Match data in `layout.json` to the live DOM; no runtime measurement from static Vue source or isolated fixtures is allowed to count as app measurement.

## Step 2: Figma traversal evidence

Use `assets/figma-inventory.v5.template.json`. Traverse frame > sections > descendants, including hit areas and visually repeated instances. Record `id`, `path`, `parentId`, `role`, exact `text`, direct source, observed values and screenshot path. Show the expanded Layers panel, selected Properties panel, actual distance overlays. Include expected spatial relations (e.g., next.top minus prior.bottom). Record missing/inaccessible branches as PARTIAL. Do NOT assume Figma layer node === one DOM div.

## Step 3: candidate matches and explicit review

```bash
node <skill-dir>/scripts/v5-audit.mjs match --figma .design-qa/terms/figma-inventory.json --dom .design-qa/terms/dom-inventory.json --out .design-qa/terms/mapping-candidates.json
```

The first command is EXPECTED to exit non-zero because no mappings have been reviewed. This is intentional. Review candidates against both the visible Figma layer and real-app DOM. Create `approved-mapping.json` from the template, then:

```bash
node <skill-dir>/scripts/v5-audit.mjs match --figma .design-qa/terms/figma-inventory.json --dom .design-qa/terms/dom-inventory.json --approved .design-qa/terms/approved-mapping.json --out .design-qa/terms/mapping.json
```

No model-inferred pairing can be accepted as verified. Unmatched Figma or interactive DOM elements block full PASS until resolved or the scope is explicitly narrowed and reported.

## Step 4: geometry + box-model and relational audit

```bash
node <skill-dir>/scripts/v5-audit.mjs geometry --figma .design-qa/terms/figma-inventory.json --dom .design-qa/terms/dom-inventory.json --mapping .design-qa/terms/mapping.json --out .design-qa/terms/v5-geometry.json
```

Checks include outer bounds, optional CSS computed values, content width/height derived from actual border/padding, and rendered element-edge distances. `expectedBox`, `expectedCss`, `expectedContent` each contain only values individually observed from the Figma UI. Specify an explicit Figma measurement for each relation. No silent guessed values. False positive from Figma's pixel rounding may require a **documented** tolerance exception, never blanket tolerance increases. Re-capture after every repair; inspect parent, siblings, next affected region.

## Step 5: blind independent resweep

Use `assets/v5-independent-review.template.json`. Start from the Figma UI again with no reliance on the first inventory. A second *different* reviewer/agent must have actual direct browser access to be labeled independent. One agent doing a second pass is valuable but is **not an independent review** and is therefore PARTIAL under this strict gate. Do not fabricate a second reviewer ID. If no eligible independent reviewer exists, report the limitation, keep the existing single-review evidence, and do not claim full VERIFIED.

```bash
node <skill-dir>/scripts/v5-audit.mjs independent --first .design-qa/terms/pass-one.json --second .design-qa/terms/pass-two.json --out .design-qa/terms/independent.json
```

Newly discovered Figma items (not in pass-one) must be added to the design inventory and mapping and verified again. Confirm both passes refer to the same frame/viewport.

## Step 6: completeness gate / final reporting

```bash
node <skill-dir>/scripts/verify-detail-audit.mjs --audit .design-qa/terms/detail-audit.json
node <skill-dir>/scripts/v5-audit.mjs gate --mapping .design-qa/terms/mapping.json --geometry .design-qa/terms/v5-geometry.json --independent .design-qa/terms/independent.json --v4 .design-qa/terms/audit-gate-report.json --out .design-qa/terms/v5-final.json
```

The final report MUST include real observed values and signed deltas, unmatched regions, viewer access limitations, whether the independent pass was truly independent, corrections to previously false PASS statements, v4 status, and remaining risks. A synthetic script test never establishes actual product fidelity.

## Mandatory mutation tests before release

`node tests/v5-selftest.mjs` must reject: box width mutation, rendered gap mutation, omitted mapping, truncated DOM inventory, duplicate reviewer, and a second-pass newly discovered layer. Tests are synthetic fixtures; actual Figma and app smoke tests are separate acceptance steps.
