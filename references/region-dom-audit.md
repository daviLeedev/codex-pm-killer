# Region-to-DOM auditing protocol

**Unit = one semantic Figma visual region mapped to the actual runtime DOM region.** A Figma group does not necessarily map to one `div`; a mapping may consist of multiple DOM selectors.

1. Open existing authenticated Figma viewer in Codex in-app browser. Navigate visible layer tree, select parent then children, collect direct Properties panel values and evidence. Never call Figma MCP/API.
2. Open the **real app** in browser, not a static extracted markup approximation. Inventory actual visible nodes and identify matching semantic regions. Store `region-map.json` using the assets template, including `scope.route`, `scope.viewport`, `regions[].figmaPath`, `regions[].domSelectors`, `regions[].matchMode`, `regions[].source`, `regions[].figmaEvidence` and `regions[].expectedBox`.
3. Record `relations` with `from`, `fromEdge`, `to`, `toEdge`, `expectedPx`, `source` and `figmaEvidence`. Measure rendered distances as `next.top - previous.bottom`. Never accept a CSS `gap` or `margin` declaration as proof of actual distance.
4. Compare parent, child, immediate siblings and next dependent region. Watch for padding + margin accumulation, margin collapse, scrollbars, line boxes, overflow and responsive constraints.
5. Distinguish click/touch target rectangle, icon wrapper and painted SVG glyph. Distinguish font sizes on `strong` and parent text line-box height.
6. For screenshot comparisons match same exact text/state, viewport size, browser zoom, fonts loaded and preferably DPR. Only after baseline is confirmed, run overflow and breakpoint stress cases.
7. Figma evidence grades: `FIGMA_UI_OBSERVED` or `FIGMA_UI_MEASURED` for direct inspected values. Code inference, screenshot estimation or inaccessible data must not pass a numeric verification check.
8. App evidence grades: `APP_RUNTIME_MEASURED` only after reading real rendered browser geometry and computed CSS. Source inspection, code-only, isolated snippets and compilation are weaker.
9. Run `node scripts/compare-region-geometry.mjs --map .../region-map.json --actual .../render/layout.json --out .../region-report.json`. A good result only proves **declared** region assertions, not that all Figma nodes were discovered.
10. Unmatched Figma layers, unmatched DOM nodes, inaccessible states or untested properties are PENDING/BLOCKED. Do not state entire design verified if any remain.
