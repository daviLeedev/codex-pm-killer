# Real application verification

1. Check app framework and existing run scripts. Use the actual app route, global CSS, runtime components, i18n and data sources. Separate browser source-only fixtures from actual Vue/React runtime.
2. Match exact Figma baseline state, text, name, viewport dimensions and DPR. Wait for fonts and stable layout.
3. Use `capture-local.mjs` or current connected browser to measure `getBoundingClientRect()`, computed CSS, line fragments and actual DOM. Ensure capture was not truncated.
4. Compare expected directly observed Figma values with measured actual DOM values; run `compare-layout.mjs` and `compare-region-geometry.mjs`. Verify adjacent element **boundary distances**, not only CSS gap declarations.
5. Optionally run `compare-images.py` for same-size overlay/diff. Differences include anti-aliasing and browser font rendering and are diagnostic, not acceptance proof.
6. Run wrapping boundary widths before/at/after threshold, and state variants. For reported bugs, collect BEFORE evidence or label mitigation only.
7. Modify the smallest necessary CSS/component area, preserving functionality. After each change inspect parent/siblings/next dependent region. Finish with an independent second sweep.
8. Run build/typecheck/lint and real app regression checks; do not claim these prove iOS device behavior or inaccessible internal-network API paths.
9. Write evidence-grade acceptance report listing verified scope, incomplete scope, measured deltas, unresolved gaps, screenshots and exact tool limitations.
