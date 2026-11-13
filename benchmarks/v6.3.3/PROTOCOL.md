# Official Benchmark Protocol v3 — v6.3.3

This is a **measurement-harness-only** change. Preserve v6.3.2 skill, Figma Inspector, DOM Inspector, Difference Analyst and Fixer behavior. Do not modify them merely to improve scores.

## A/B/C definitions and the controlled variable

| Group | Skill | Model | Workflow |
|---|---|---|---|
| A Plain Prompt | no access to codex-pm-killer | same model and effort as B | investigate Figma independently, implement, self-review and fix |
| B Single Skill | codex-pm-killer v6.3.2 behavior | identical to A | skill-guided investigation, implementation, QA, fix |
| C Parallel Skill | same skill | report each worker's model | **native concurrent agents**, independent roles and final review |

All groups have same Home Figma URL and read-only browser rights, same blank Vue starting SHA, fonts, substitute asset SHA, viewport, tool permissions and time/expense constraints. A must **not** be fed skill-collected Figma Properties, benchmark truth, B/C tool results or task-specific QA findings. A may inspect Figma itself and correct its own mistakes. The host must provide real filesystem isolation, not merely separate prompts.

## Track I — End-to-End implementation

Start **fresh** A/B/C workspaces from the same initial Vue project, inspect mobile Home in actual Figma viewer (not Figma MCP/API/plugin), implement, review, fix, run/build, capture real Vue Chromium DOM and screenshot. An **independent evaluator** checks same 150 frozen Figma assertions, and additionally reports icon/photo asset fidelity separately. Key metrics: MATCH/MISMATCH/NOT_EVALUABLE, major regions missing, rendered geometry, typography, assets, time and API spend.

## Track II — Controlled QA & Fix

A/B/C get an **identical faulty Home** with >=20 preregistered injected defects and >=20 known-good controls. Keep defect Gold **outside agent-readable workspaces**. Each reports IDs found and attempted IDs fixed; separately independent before/after 150-assertion evaluators must verify MISMATCH -> MATCH for confirmed fixes. Count TP/FP/FN, precision, recall, confirmed fixes and regressions. Do not infer repaired from an agent's "fixed" claim.

**End-to-End and QA are separate scores.** No averaged single percentage hides QA failures.

## Locked protocol and input parity

Before calling an API, use v6.3.2 `freeze-truth.mjs`, `asset-pack.mjs` and `readiness-gate.mjs` to create verified private `goldLock`, `assetLock` and `readinessReport` artifacts. Their hashes and approved cap must match the new run; otherwise preparation must fail. Then create a private plan JSON following \`assets/v6.3.3-plan.example.json\`. Lock \`skillCommit\`, \`evaluatorCommit\`, \`protocolVersion\`, \`figmaUrl\`, design frame ID and viewport, \`initialProjectSHA\`, Gold 150 assertion SHA, QA mutation Gold SHA, asset pack hash, actual model IDs/reasoning, browser version and aggregate cost cap. Run:

\`\`\`bash
node benchmarks/v6.3.3/prepare.mjs --plan .design-qa/v633-plan.json --out .design-qa/runs/unique-algolia-home
\`\`\`

Generates six byte-identical initial copies by track (three per track), excludes .git/.env/.design-qa/node_modules and refuses source symlinks. Gold is never copied. Prompts A/B/C are independent and recorded with hashes. Prepped directories are NOT operating-system sandboxes and do not prove what host actually sent to models.

If an agent cannot access the original Figma, no end-to-end fidelity claim is permitted. If A's host context/transcript is inaccessible, a contamination check cannot pass. Keep Gold inaccessible to all A/B/C through actual host permissions.

## Independent results and reproducibility

Supply per-group post-run evidence under \`RUN/evidence/track-I/{A,B,C}\` and \`RUN/evidence/track-II/{A,B,C}\`:

- \`run.json\`: {initialProjectSha256,model,reasoning,completed:true,realVueRuntime:true}, and wall-clock/token/usage metadata.
- \`inbound-context.json\`: full **inbound** system/developer/user/tool inputs for contamination assessment, NOT model output.
- \`final-quality.json\` (Track I) or \`before-quality.json\` and \`after-quality.json\` (Track II): independent v6.3.2 evaluator output with \`expectedSha256\`, \`actualSha256\`, 150 unique assertion checks.
- \`detected.json\` (Track II): \`{"issues":[{"id":"mutated-assertion-id"}],"attemptedFixIds":["mutated-assertion-id"]}\`.

C requires a native-host session log with distinct agent.spawn session IDs linked to immutable host log SHA, two task intervals overlapping at least one second, and no Figma browser lock conflict. Generate:

\`\`\`bash
node benchmarks/v6.3.3/parallel-proof.mjs --events PRIVATE_EVENTS.json --evidence-root PRIVATE_HOST_LOGS --out PRIVATE_PARALLEL_PROOF.json
\`\`\`

If only prompt roles were executed sequentially, C is \`C_PARALLEL_BLOCKED\`, not a simulated PASS. The script cannot authenticate the host's log source.

Each API request uses a fresh **combined $10 user-approved** v6.3.2 budget journal (request IDs \`I-A-...\`, \`II-B-...\`, etc.), recording raw response, usages, failures and settled costs. For each request, store the authenticated normalized usage record under `PRIVATE_RUN_DIR/evidence/track-{I|II}/{A|B|C}/usage/<request-id>.json` with `{requestId,model,inputTokens,outputTokens,cachedInputTokens,reasoningOutputTokens}`. Its SHA-256 MUST equal the v6.3.2 budget journal `usageSha256`. Do not rewrite historical $5 journal or previous A/B/C benchmark. No API calls in this harness.

Post-run grading is offline:

\`\`\`bash
node benchmarks/v6.3.3/grade.mjs --run PRIVATE_RUN_DIR --qa-gold PRIVATE_QA_GOLD.json --ledger PRIVATE_LEDGER.json --parallel-proof PRIVATE_PARALLEL_PROOF.json --out PRIVATE_GRADED.json
\`\`\`

One run per group is exploratory. Repeat at least three independent **fresh** paired runs before statistical claims, with separately authorized aggregate spend; do not reuse any A/B/C implementation. Report costs and elapsed time separately from final design and QA quality. Do not reveal private Gold, prompts, screenshot bodies or raw API output in public Git. Publish only privacy-reviewed immutable aggregates under \`benchmarks/history/\`.
