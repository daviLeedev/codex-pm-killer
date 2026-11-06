# Strict detail-fix checklist and acceptance

Use when a rough page is implemented and the user repeatedly finds missed details. Do **not** redesign. A build that compiles is not a design acceptance test.

## Coverage
Create page inventory from Figma layer panel and actual app DOM independently. Pair regions by role, not by tag count. Include each distinct visible control and every repeated instance placement/label/wrapping; sample only a shared style definition, never skip physical instances. Record frames and states: overlay, modal, expanded/collapsed, selected, disabled, loading, failure, success and viewport variants that are in scope.

## Expected vs actual
Per mapped region, compare: outer bounds; parent flex/grid/Auto Layout/constraints; padding; visible child geometry; measured **rendered** sibling gap; final card height; text font family/weight/size/line-height/letter spacing/paragraph breaks; border radius/colors/shadow; icon wrapper/glyph/hit target; scrolling and clipping. For each check store evidence source, expected, measured, signed delta, tolerance and status. Observed values may use default +/-1px geometry tolerance; agree explicit exceptions, never quietly relax thresholds. Unobserved or estimated values cannot PASS.

## Reported symptom reproduction
Before changes, capture exact user-reported width/state/copy and the bug. If original symptom cannot be reproduced, label as probable-cause mitigation and mark the reported case incomplete, not confirmed resolved. For wrapping, test width before/at/after the line-count threshold, and explicitly reported widths.

## Behavior
For navigation/auth interactions, record click → async → store reset → watchers → router guards → navigation → unmount. Verify success, cancellation, competing navigation and repeated click; inspecting each operation separately is insufficient.

## Every edit
Remeasure target, its parent, direct siblings and first following dependency. After **last** edit, repeat a full-page second sweep directly against both Figma and the real app. A sub-agent with only inherited screenshots is evidence review, not independent Figma review.

## Completion gate
Use `verify-detail-audit.mjs`. An audit cannot be VERIFIED if scoped region is missing mapping, a numeric property is estimated, original reported issue never reproduced, actual app not measured, visual/behavioral regression omitted, second sweep missing, or any issue unresolved. A PASS from JSON consistency checks is only a consistency result, not proof that the Figma layer inventory was exhaustive.
