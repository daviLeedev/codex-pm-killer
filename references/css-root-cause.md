# CSS Root-Cause Tracing — v6.4.1

Use the browser's computed style and CDP `CSS.getMatchedStylesForNode` to enumerate **applied rules**, not merely CSS source grep.
Link each mismatch to a unique runtime selector, current design measurement, actual box/style and direct evidence hashes.

## Which cause to investigate first?

- For two or more siblings with the same x/y displacement, investigate the shared parent before changing each child. A shared offset is only a correlation.
- For a single wrong dimension, inspect width/height/max constraints and inherited flex/grid behavior.
- For a wrong gap, distinguish actual rendered sibling edge distances from CSS `gap`, margins and padding.
- For font mismatch, verify CDP rendered font faces and font loads; CSS `font-family` declarations alone do NOT certify used glyphs.
- For imagery, inspect actual image presence, asset ID, dimensions/object-fit and clipping; substitutes cannot prove source-photo identity.

## Evidence standards

CDP matched rules indicate **potentially applied rules**, not source-of-truth cause. Vite sourceURL mapping to an existing local Vue/SCSS file is a candidate.
Generated style nodes, inline CSS, CSS modules and source-map-transformed rules can be ambiguous; mark `SOURCE_UNVERIFIED` rather than inventing a path.
A candidate fix must use a small scoped edit, require a real before/after capture and roll back if P0/P1 errors newly appear.

## Commands

```bash
node scripts/fidelity/discover-dom.mjs --url http://localhost:5173 --width 375 --height 800 --out .design-qa/dom.json
node scripts/fidelity/match-regions.mjs --design .design-qa/verified-design.json --runtime .design-qa/dom.json --out .design-qa/mapping.json
node scripts/fidelity/detect.mjs --design .design-qa/verified-design.json --runtime .design-qa/dom.json --mapping .design-qa/mapping.json --out .design-qa/issues.json
node scripts/fidelity/trace-css.mjs --url http://localhost:5173 --issues .design-qa/issues.json --project-root . --out .design-qa/css-trace.json
node scripts/fidelity/plan-fix.mjs --issues .design-qa/issues.json --trace .design-qa/css-trace.json --out .design-qa/fix-plan.json
```

These are product QA artifacts. Never provide benchmark-hidden Gold to the Fixer.
