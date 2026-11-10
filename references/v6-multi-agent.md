# v6: Balanced multi-agent Figma QA (on top of v5)

## Capabilities / what is and is not automated

- Codex **host** spawns, joins and closes the agents. `scripts/v6-orchestrator.mjs` is a deterministic, file-backed **coordination/validation gate**, not an LLM dispatcher or browser-control API. An `assign` success is not proof a subagent was spawned.
- Real Codex role TOMLs are generated in the **target project**'s `.codex/agents` directory; the generator only writes available model IDs supplied by the user/host. If absent, they inherit their parent model. Never assume that a label such as Sol/Luna/Terra equals a runnable model ID or that the model selected by the UI can be changed by a skill.
- The only editable actor is the fixer, and even the fixer cannot override host permissions. All other roles should operate read-only. Each agent must respect the real workspace ACLs; script checks cannot themselves sandbox agent tools.
- **No Figma MCP, API, plugin or Dev Mode subscription**. Figma access must be the live authenticated read-only viewer. If no subagent can access that browser, delegate direct observation to **MAIN** with a browser lease, and use others for read-only DOM or screenshot review. A screenshot-only reviewer cannot count as independent live-Figma verification.
- Host subagents may share files but not authenticated browser sessions. **Do not let two agents click the same Figma tab**; acquire/release the browser lease explicitly. An advisory file lock cannot prevent human or external tools from clicking: this is a workflow contract. A stale lease is not automatically stolen.

## Allocation / dependency graph

| Order | Role | Suggested model family | Permission | Dependencies | Output |
|---|---|---|---|---|---|
| 0 | MAIN orchestrator | Sol Medium | state coordination | none | `state.json` |
| 1a | Figma Inspector | Sol Medium | view-only browser | none, browser lease | `figma-inventory.json`, evidence |
| 1b | DOM Inspector | Luna if available | app read-only/runtime | none | `layout.json`, screenshot |
| 2 | Difference Analyst | Sol High | read-only | 1a + 1b | `differences.json` |
| 3 | UI Fixer | Sol Medium | limited app write | 2 | patch, regression evidence |
| 4 | Independent Reviewer | Sol Medium | view-only browser | 3, **different actor from 1a** | `second-inventory.json` |
| 5 | Gate | Node.js | read-only | 4 | v4/v5/v6 reports |

Run **only 1a and 1b concurrently** to start. Never spawn all four agents at once: C needs their results, D needs C, reviewer needs D's stable version. Limit 2 active worker turns (separate from main) in the balanced policy. For small isolated screens, main can do the work sequentially; that does **not** count as independent verification.

## Evidence contract and privacy

Target app's `.design-qa/v6/` includes `scope.json` (MAIN-written immutable baseline with `figmaFrame`, `appRoute`, `viewport`, `baselineContentSha256`), `state.json` (automatic), `figma-viewer-capability.txt`, `dom-runtime-capability.txt`, and per-task contract files. Sample: `assets/v6-result.template.json`. Keep **actual** screenshots, internal route, Figma URLs, names and browser leases in the **target application's ignored `.design-qa/`** only. `config/` and sample fixtures here are synthetic.

Every result: `schemaVersion:1`, `runId` from state, exact `scope` from state, `role`, `actor`, `status` (`PASS`, `PARTIAL`, `BLOCKED`), nonempty relative `artifacts` paths. The coordinator checks each evidence file exists inside target workspace and stores its SHA-256, but cannot verify screenshot genuineness. Role-specific claims:

- Figma: `figmaDirect:true`, `figmaSource:"FIGMA_UI_OBSERVED"`, direct capability and active same-owner browser lease.
- DOM: `appSource:"APP_RUNTIME_MEASURED"` and recorded runtime-capable agent.
- Difference: `sourceTasks:["figma","dom"]`, `crossChecked:true`, real stored comparison artifact.
- Fixer: `changedFiles:[...]`, `regressionTests:[...]`; actual code edits and successful tests must be externally reviewed.
- Reviewer: above Figma requirements, `independent:true`, `originalInspector:<first actor>`, `newlyFoundRegions:[...]`, must not reuse first inspector identity.
- Gate: `reportPaths: {v4, v5, independent}` must point to nonempty reports whose verified statuses are re-read, plus `discrepanciesResolved:true`. The coordinator validates report files, not merely model-written booleans; screenshots/claims can still be fabricated and require human scrutiny.

**Never promote gate PASS into “pixel perfect”, “exhaustive layer coverage” or “verified independent” without real-world evidence of matching scope**. Explicitly report all unvisited branches and states.

## Commands (from target app project directory)

```bash
SKILL=/path/to/codex-pm-killer
node "$SKILL/scripts/v6-orchestrator.mjs" init --workspace "$PWD" --scope .design-qa/v6/scope.json
# Supply tangible capability evidence paths in the target app, never fabricate access.
node "$SKILL/scripts/v6-orchestrator.mjs" capability --workspace "$PWD" --actor inspector-A --figma true --evidence .design-qa/v6/figma-viewer-capability.txt
node "$SKILL/scripts/v6-orchestrator.mjs" capability --workspace "$PWD" --actor inspector-B --figma false --dom true --evidence .design-qa/v6/dom-runtime-capability.txt
node "$SKILL/scripts/v6-orchestrator.mjs" browser --workspace "$PWD" --action acquire --actor inspector-A
node "$SKILL/scripts/v6-orchestrator.mjs" assign --workspace "$PWD" --task figma --actor inspector-A --model <actual-supported-model-id>
node "$SKILL/scripts/v6-orchestrator.mjs" assign --workspace "$PWD" --task dom --actor inspector-B --model <actual-supported-model-id>
# Host actually delegates the work, and each agent records results via the record command.
# Release browser using nonce printed by acquire; different reviewer acquires later.
node "$SKILL/scripts/v6-orchestrator.mjs" status --workspace "$PWD"
node "$SKILL/scripts/v6-orchestrator.mjs" gate --workspace "$PWD"
```

If Codex supports custom agents, generate project-scoped definitions **after the host confirms actual model IDs**:

```bash
node "$SKILL/scripts/v6-generate-agents.mjs" --model-map "$SKILL/config/model-map.example.json" --out .codex/agents
```

The example blank model map inherits the current model and does not provide cheap-model routing until populated with valid IDs. Some host environments cannot use subagent-specific models, in which case use the same role contracts but one shared model.

## Retry, escalation, and budget

`config/v6-balanced.json` provides role-specific abstract **work-unit** reservations (NOT USD, tokens or an account spending cap). State is updated through an atomic directory mutex; concurrent dispatch may fail rather than overbook. If usage telemetry is available, pass measured units to `record --units N` but these are *reported* values, not API billing. With missing telemetry, use the estimate and label it ESTIMATED. `Astra` is **blocked by default**; the CLI cannot authorize it based on its own generated text. Ask the user explicitly, then change policy/config externally with authorization. No automatic model switches.

A PARTIAL/BLOCKED task never satisfies dependencies. Retry only after identifying cause, using `retry --task TASK --reason REASON` within `maxRetriesPerTask`. On exhaustion, write escalation proposal (`escalate`); task remains unresolved and full PASS is prohibited. A read-only reviewer without direct Figma view is BLOCKED, not independent.

## Host spawning (in prose, not CLI automation)

1. MAIN reads skill and policy, discovers available tools/models/subagent support and browser-sharing capabilities. If no direct-access Figma subagent, MAIN is Figma owner. MAIN checks all handoffs against scope and budget.
2. MAIN delegates independent Figma and DOM tasks only when both capabilities and available threads are established; else sequential fallback. The scripts reserve concurrent capacity, but they **do not create actual agent threads**.
3. MAIN gives A only Figma URL/frame, viewer control and contract; gives B only local app route/state, NOT A's measured values. Keep source evidence independent. After both results, C gets only structured evidence and checked frame/viewport/text; D gets reviewed mismatch list. Do not share extra browser or source access.
4. The single writer D repairs the approved differences. Browser A or another direct-access reviewer independently rechecks final frame after D's commit. Make independent reviewer use a distinct browser lease, not concurrent Figma manipulation.
5. MAIN checks old v4/v5 reports, evidence hashes, unreconciled layer inventories, rejected user-reported bugs, functional smoke and budget. Do not claim success from a passing JSON format alone.

## Threat model and limits

- A role TOML is a *prompt/host configuration*, not a cryptographic sandbox; permissions should be enforced at host OS/tool level as available.
- File-based mutex protects updates made **through this script** only. External Codex calls or tab clicks do not consult it unless instructed to do so.
- Manual evidence claims can be fabricated; no local script can independently certify Figma screen authenticity or a genuine different reviewer.
- Need real user project for browser-control, real measurements, routing, iOS and exact model support testing. Synthetic tests cover script invariants only.
