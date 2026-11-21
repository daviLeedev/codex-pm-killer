# v6.4.2 Verified Fix Loop

**Never accept a model's own assertion that it has fixed the issue.**
Use actual application in Chromium, with Figma observations independent from the hidden benchmark Gold.

## Apply one CSS change

Create a private patch plan containing one edit, for example:

```json
{"schemaVersion":1,"patchId":"cta-width-01","issueIds":["CTA-WIDTH"],"allowedProperty":"width","changes":[{"file":"src/components/CTA.vue","find":"width: 300px;","replace":"width: 320px;"}]}
```

Then call:

```bash
node scripts/fidelity/patch-transaction.mjs apply --app-root APP --tx-dir PRIVATE/transactions/cta-width-01 --plan PRIVATE/patch-plan.json --out PRIVATE/patch-receipt.json
```

**The patch is provisional.** Run the actual app and use discover-dom.mjs + match-regions.mjs + detect.mjs again to produce fresh AFTER reports. Keep before and after screenshots and their JSON in separate directories.

## Verify and settle

Write a private verification manifest with absolute paths to beforeDiff, afterDiff, beforeRuntime, afterRuntime, scope, patchReceipt.
Scope must contain {schemaVersion:1, viewport:{width,height},fullPage:true,requiredRegionIds:[target,parent,siblings...]}.

```bash
node scripts/fidelity/patch-transaction.mjs finalize --app-root APP --tx-dir PRIVATE/transactions/cta-width-01 --verification PRIVATE/verify-inputs.json --out PRIVATE/final-verdict.json
```

This **re-runs verify-patch.mjs** independently, checks unchanged Figma design digest, real-app runtime SHA, actual screenshot SHA, viewport/route equality, impacted regions, target resolution and all new/worsened P0/P1 issues.
Accepted changes keep the source. Rejected changes are automatically restored to original bytes; the final verdict carries rollbackCompleted=true and restoredSourceSha256.
After interruption, call `patch-transaction.mjs recover` on the open transaction; never reissue an unverified patch blindly.

## Region-based visual diagnostics

```bash
node scripts/fidelity/visual-diff.mjs --reference PRIVATE/figma.png --actual PRIVATE/app.png --regions PRIVATE/regions.json --masks PRIVATE/masks.json --out PRIVATE/visual
```

Reference and actual screenshots require identical dimensions/DPR and stable zoom. Photo-content masks may exclude only known unavailable Figma photo interiors; image layout and bounds must still pass numeric checks. Pillow is required.

## Explicit limitations

The patch transaction does not itself control a generative model or the authenticated browser. CSS patches are intentionally one property at a time; structural HTML/Vue changes require a separate reviewed edit and the same independent browser re-verification. A screenshot comparison is not proof of exhaustive Figma inventory.
