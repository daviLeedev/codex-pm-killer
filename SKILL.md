---
name: codex-pm-killer
description: Inspect view-only Figma designs using a host-provided authenticated browser (Codex, Claude Code, Gemini CLI, or another capable coding agent) without Figma MCP/API, extract observable layout/typography/spacing values and layer hierarchy, implement them in the existing web app, and iteratively verify rendered UI with Playwright and documented evidence. Use for Figma-to-code, pixel-accuracy audits, UI reconstruction, and especially strict detail-fix after an initial rough UI has been implemented, when the user provides a Figma link or an already-open Figma browser tab.
---

# Codex PM Killer — Evidence-Driven Fidelity (v6.4.3)

**Purpose:** reproduce an observed Figma view-only design in a real Vue app using measured UI differences, CSS root-cause candidates, scoped code changes and independent browser re-verification. The skill must execute tools, not just promise pixel-perfect results.

## Required environment
- Authenticated Figma browser with visible read-only Layers/Properties; **no Figma MCP, REST/GraphQL/private API, plugin, or Dev Mode**.
- Actual app files, Node 22+, local Vue server and Playwright Chromium. If unavailable, report PARTIAL/BLOCKED; do not fabricate access.
- Private `.design-qa/` proof and an independent second Figma reviewer. Use `references/provider-neutral-execution.md` and `scripts/host-preflight.mjs`.

## Mandatory B single-agent workflow
1. Inspect the entire requested Figma frame and repeating elements via the visible UI. Save paths/parent/order and measured Properties with source evidence SHA. Run `scripts/fidelity/inventory.mjs` (no invented values).
2. Initialize `scripts/fidelity/run.mjs init` and enter `observe` with the verified design inventory. Read `references/fidelity-execution.md`. Skipping controller states or claiming DONE after build only is forbidden.
3. Run the real Vue app and call `scripts/fidelity/discover-dom.mjs --url http://localhost:PORT`. Use `match-regions.mjs`, `detect.mjs` and controller `capture/map/detect` stages. Missing, extra or ambiguous regions cannot silently disappear.
4. For every P0/P1 defect, collect applied CSS rule candidates via `trace-css.mjs`; use `plan-fix.mjs` to prioritize parent offset causes. Source-path hints are hypotheses, not established causes. See `references/css-root-cause.md`.
5. Use `context-pack.mjs` to pass only 1–3 priority issues, evidence/delta and pertinent Vue source snippets to the coding model. Do not send the full historic skill or benchmark hidden Gold.
6. Run `patch-transaction.mjs apply` for a single scoped CSS property, RECAPTURE the identical browser state/viewport, rerun full-scope detection, then `patch-transaction.mjs finalize --verification ...`. It reruns `verify-patch.mjs`; any target unresolved or new/worsened P0/P1 regression triggers automatic rollback. Read `references/verified-fix-loop.md`.
7. Record `run.mjs diagnose/patch/verify/next`. Continue until errors are resolved or the authorized iteration/budget is reached. Structural Vue-template edits require reviewed authorization and the SAME real-app before/after QA gate.
8. Require a DIFFERENT actor with real Figma access to inspect the final screen, plus new app browser capture, full-page and affected-neighbor regression and build/typecheck. Use `run.mjs review/done`. Unresolved required regions => PARTIAL, never false PASS.

## Evidence, assets, privacy
- Distinguish directly measured Figma properties, rendered DOM/CDP CSS and unverified estimates. CSS `font-family` declaration alone does not attest actual used glyph font.
- Check spacing/geometry/text/child order/icons/image loading/scroll separately. `visual-diff.mjs` provides diagnostic overlays, not proof by itself.
- Substitute assets can prove placement, size/cropping and loading but NEVER original-photo pixel equivalence.
- Store raw client Figma screenshots, code, tokens and browser sessions privately; only sanitized summaries belong in public Git.
- `implement` mode builds then validates; `detail-fix` mode must preserve current architecture and reproduce the reported problem before editing.

## Benchmark and multi-agent boundaries
- A Plain Prompt cannot read this skill, pre-extracted B/C Figma properties or hidden Gold. B uses this single-agent loop. C requires actually overlapping native subagents, not sequential role labels.
- The official independent v6.3.3 End-to-End + QA evaluator and Gold are **unchanged** and never exposed to development agents. Start with B improvements before optimizing C.
- For role locks/capabilities read `references/v6-multi-agent.md`. Cross-project lessons are advisory only (`references/knowledge-loop.md`).

## Compatibility
Complete historical detail audit and v3–v6.4.2 rules remain archived at `references/legacy-skill-v6.4.2.md` and can be read on demand. The host must execute/attest the browser; these scripts cannot spawn a model or authenticate Figma provenance themselves.
