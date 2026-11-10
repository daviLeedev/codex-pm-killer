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
