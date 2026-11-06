# View-only Figma browser inspection

Use existing Codex logged-in Figma tab. Do not launch a separate browser assuming shared cookies. No Figma MCP/API/plugin or Dev Mode upgrade.

Identify target frame via visible layer panel; select top-level frame then expand and select children. Read right Properties panel for x/y, width/height, padding, gap, alignment, direction, resizing fixed/hug/fill, constraints, colors, borders, radii, effects, fonts and line-height where viewer UI permits.

Use Alt/Option hover distance measurement if supported; record endpoints and screenshot. Viewer-based CSS copy is additional evidence and not a substitute for parent/child layout analysis.

Record the selected layer path and screenshot evidence per value. Do not infer the Figma scene graph from web DOM `getComputedStyle`; the canvas is not normal HTML. `getBoundingClientRect` is for local implemented DOM only.

If selection, layer expansion, Properties visibility or export is inaccessible, record exact blocker and grade value UNAVAILABLE; never fabricate a value or switch to Figma API.
