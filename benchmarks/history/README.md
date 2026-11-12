# Benchmark history (sanitized public summaries)

Each experiment gets **one immutable summary** under `benchmarks/history/`. Source code release notes and benchmark observations are **separate timelines**.

Store: stable run ID, date, skill version and tested commit, test scope, frozen assertion denominator, A/B/C MATCH/MISMATCH/NOT_EVALUABLE and estimated cost, important caveats and optional private bundle SHA-256.

**Never commit:** full Figma exports, screenshots, internal URLs, customer code, prompts, API raw responses, login details, tokens, original ZIP files or any private input. Put evidence in encrypted local/private storage and keep its hash in the summary for later matching. A hash cannot prove the inaccessible artifact was reviewed independently.

Corrections must create a new revision summary with `supersedes`, not rewrite previous observations. Manual privacy review is always required before public upload. The validator checks shape and common leaks, not all possible sensitive content.

`node benchmarks/history/validate.mjs benchmarks/history/2026-11-12-algolia-home-v6.3.json`

The Nov 12 record is **exploratory**, not a new v6.3.1 rerun. It preserves the original v6.3 frozen scores and known evaluator limitations.
