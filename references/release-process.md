# Release process (README patch notes)

Each released major, minor, or patch version must have a corresponding README entry.

1. Confirm working code and existing test results. Update `VERSION` to the release version (for example `6.1.0`).
2. At the top of `README.md → Version history / 패치노트`, add `### v6.1.0 — Summary (YYYY-MM-DD)`.
3. Include **Added**, **Changed**, **Validation**, **Limitations** with specific bullets. Describe actual implementation only, not speculative features. Include user-impacting behavior and known limitations.
4. Never delete or silently rewrite previous version entries. Correct factual mistakes with an explicit correction note.
5. Run `node tests/release-notes-selftest.mjs && node scripts/check-release-notes.mjs` and the relevant `tests/*-selftest.mjs`.
6. For a stacked PR, merge older version into main first, sync the newer branch with main, retarget newer PR to main, then merge only after tests pass.
7. Keep internal Figma screenshots, source, customer names, access URLs, credentials, and raw audit artifacts out of public release notes.

The release-notes checker confirms matching version and structure; it cannot prove that release notes exhaustively describe the code or that the product works in a live Figma environment.
