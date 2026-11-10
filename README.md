# codex-pm-killer

**View-only Figma browser → real DOM region mapping → strict visual/behavioral QA → reusable failure-pattern knowledge.**

Use with Codex's *currently authenticated in-app browser*. **No Figma MCP, Figma API, Dev Mode subscription, or Figma plugin.**

## Install in Codex

```bash
git clone https://github.com/daviLeedev/codex-pm-killer.git ~/.agents/skills/codex-pm-killer
# If Codex uses a project-local skills folder, clone there instead:
# git clone ... <your-project>/.agents/skills/codex-pm-killer
```

Invoke in Codex: `$codex-pm-killer detail-fix: inspect the open view-only Figma tab, map each visual region to the real app DOM, measure, fix, independently re-audit, and record anonymized learning candidates.`

**Prerequisite:** Current Codex browser must actually expose clicking/selecting Figma layers and reading the right Properties panel. Installing this skill does not grant browser permissions or access to another logged-in tab.

## What is automated and what is not

| Stage | Status |
| --- | --- |
| Read-only Figma layer selecting / properties | Agent-assisted browser actions; no automatic Figma parser |
| Map Figma region to app DOM | Agent-generated mapping, audited by scripts |
| Actual local DOM CSS / bounds | `scripts/capture-local.mjs` (requires Playwright installed) |
| Geometry/layout differences | `scripts/compare-layout.mjs`, `scripts/compare-region-geometry.mjs` |
| Screenshot overlay/diff | `scripts/compare-images.py` (requires Pillow) |
| Strict audit/reproduction evidence gate | `scripts/verify-detail-audit.mjs`, `scripts/verify-repro-matrix.mjs` |
| Reuse past failure patterns | `find-relevant-patterns.mjs` |
| Learn new issues | `extract-learning-candidates.mjs` → reviewed/redacted `ingest-reviewed-case.mjs` |
| Cross-session knowledge sync | Git commit/push/pull **after review**, not model training |

## Knowledge governance

`knowledge/patterns.json` stores general risk patterns, and `knowledge/cases` holds **anonymized** supporting cases. All initial knowledge is marked `HEURISTIC` based on a conversation retrospective, not independently reproduced by this repository. Never copy past Figma numeric values into a new file, or silently mark source-only results as runtime verification.

See [`references/knowledge-loop.md`](references/knowledge-loop.md), [`START_HERE_KO.md`](START_HERE_KO.md) and [`SKILL.md`](SKILL.md). Tests: `node tests/selftest.mjs && node tests/knowledge-selftest.mjs`.

## Security and publishing

Private repo is recommended until you review any customer-specific examples. `.design-qa/`, screenshots, browser storage, tokens, client identifiers, and production code must not be committed. There is no automatic Git push from the learning scripts.

**No guarantee of pixel-perfect results:** Browser access and observed Figma scopes may be partial. Passing the deterministic gate proves the *submitted evidence format and consistency*, not that an independent observer exhaustively inspected every Figma layer.

## v5: strict evidence-bound audits

New: [`references/v5-strict-audit.md`](references/v5-strict-audit.md) documents real-DOM inventory generation, suggested Figma-to-DOM matching with explicit approval, geometry and content-box validation, independent re-inspection, and a fail-closed combined gate. All new commands are in `scripts/v5-audit.mjs`. Run the synthetic mutation suite with `node tests/v5-selftest.mjs`.

**Important:** v5 does not read Figma programmatically; the logged-in Codex browser must inspect visible viewer Layers and Properties. A second sweep by the same agent is not independently verified. If these requirements cannot be met, the audit status stays PARTIAL.

## v6 — balanced multi-agent coordination

See [`references/v6-multi-agent.md`](references/v6-multi-agent.md). The coordinator (`scripts/v6-orchestrator.mjs`) implements task dependencies, atomic state serialization, exclusive browser-owner lease, capability evidence, role-specific handoff contracts, a **2-worker** admission limit, estimated work-unit budgeting and fail-closed escalation. It does **not** directly spawn Codex agents, bypass login permissions, change model selection, or charge real credits.

**Suggested default:** MAIN Sol Medium; Figma inspector Sol Medium, runtime DOM inspector a cheaper available model, Difference Analyst Sol High, UI Fixer Sol Medium; second Figma reviewer must be genuinely independent with direct access. Astra is off unless the user explicitly approves it. Model family labels are preferences, not verified Codex model IDs; generate actual project `.codex/agents` TOMLs using `scripts/v6-generate-agents.mjs` and your *available* model IDs. If direct browser sharing is unavailable, MAIN owns Figma inspection and independent direct Figma verification remains BLOCKED unless another agent gets its own viewer access.

Quick test: `node tests/v6-selftest.mjs` (synthetic invariants, not a live Figma fidelity claim).


## v6 Smart Context Engineering (role-scoped, resumable)

See [`references/v6-context-management.md`](references/v6-context-management.md). `scripts/v6-context.mjs` keeps an evidence-hashed local ledger, builds bounded task packs, separates Figma/DOM/reviewer working contexts, and creates strict hash-verified checkpoints for session resumes. `config/v6-balanced.json` **requires a current role pack for each new agent assignment**; previously generated packs must be re-issued if their source evidence changes. `config/v6-context.json` defines per-role character ceilings (not precise token or billing limits).

```bash
# In the target application's directory, AFTER v6-orchestrator init:
node /path/to/codex-pm-killer/scripts/v6-context.mjs init --workspace "$PWD"
node /path/to/codex-pm-killer/scripts/v6-context.mjs pack --workspace "$PWD" --task figma
node /path/to/codex-pm-killer/scripts/v6-context.mjs pack --workspace "$PWD" --task dom
# Repeat with difference, fixer, review, gate when each stage becomes ready.
node /path/to/codex-pm-killer/scripts/v6-context.mjs checkpoint --workspace "$PWD"
node /path/to/codex-pm-killer/scripts/v6-context.mjs resume --workspace "$PWD"
```

Validation: `node tests/v6-context-selftest.mjs`. **Context packs reduce supplied input, not necessarily total model cost**; rework rates and real usage must be measured in Codex. This is a local file-backed contract, not direct access to Codex's hidden context/compaction internals.
