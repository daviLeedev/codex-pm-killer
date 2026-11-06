# Knowledge loop — cross-project learning

## Before an audit
Run `node scripts/find-relevant-patterns.mjs --query "<screen context and issue types>" --top 8` from the skill. Use results as risk hypotheses and append checks to the page coverage inventory. Previous project values are never design truth for this project.

## During an audit
Keep all raw proof in the **app repo** under `.design-qa/<page>/`, excluded from the reusable skill repo. For each discrepancy capture: expected value and its actual Figma viewer source, real-app measured value, before/after state, tested width, root cause, original missed assertion, impacted parent/children/siblings, and post-fix regression evidence.

## After an audit
Run `node scripts/extract-learning-candidates.mjs --audit .design-qa/<page>/detail-audit.json --out .design-qa/<page>/learning-candidates.json`. These are DRAFTS. Manually inspect and redact before ingestion; do not publish screenshots, file URLs, client names, private source, login state, tokens, or account data.

Only an explicitly reviewed, anonymized `CASE-NNNN.json` with an evidence grade may be added using `node scripts/ingest-reviewed-case.mjs --input <reviewed-redacted-case.json>`.

Status: `HEURISTIC` = reported or source-based risk; `VERIFIED` = independently reproduced design/application mismatch supported by direct evidence; `DEPRECATED` = disproven or replaced. No automated promotion.

Run `node scripts/validate-knowledge.mjs` and `node tests/knowledge-selftest.mjs`, review Git diff and commit/push the skill repo. Pull updates in future projects. This is filesystem-backed reusable learning, **not model training**.

## Safety
Public repo is not a place for Figma frames, captured customer UI, screenshots, internal domains, business rules, source snippets or metadata. Evidence truth is more important than accumulating cases. Incorrect lessons must be corrected or deprecated.
