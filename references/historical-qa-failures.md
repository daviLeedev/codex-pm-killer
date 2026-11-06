# Anonymized QA failure patterns (reported retrospective, not independently confirmed)

Use as reusable **risk hypotheses**, never as values to copy into another design.

- **Cumulative gaps:** CSS padding, margins, line-height and list height may combine to make a parent card differ from Figma despite individually plausible declarations.
- **Hit target vs glyph:** A close button may have a larger interaction rectangle than the SVG image it contains; labels and arrow wrappers must also be measured.
- **Mixed typography:** `strong` and normal inline elements with different line heights change visual line boxes and shift following siblings.
- **Responsive text:** `min-height` with vertical centering can move paragraphs when lines wrap; check just before and after breakpoints, including reported widths.
- **State transitions:** Resetting authenticated customer state can activate watchers/guards that compete with a requested external navigation; test the full event timeline and cancelled navigation.
- **False PASS:** Build success, source-only fixtures and a reviewer without direct Figma access do not constitute design verification.

For every rediscovered defect, record which earlier assertion was missing and what should have prevented the error; add a regression check before closing it. Customer-specific names and screenshots belong outside this shared skill repo.
