# Provider-neutral execution contract (v6.2)

This repository is a **vendor-neutral QA protocol and a collection of Node.js verification tools**. The name `codex-pm-killer` does not imply that only Codex can execute it. Original Sol/Luna/Astra labels are **Codex-specific example preferences**, not prerequisites.

## Two layers

1. **Portable core:** scripts for real DOM inspection (Node.js/Playwright), region mapping, geometry, evidence lineage, reproducibility, result classification, context packs and the v4/v5/v6.1 gates. These depend on input files and local tools, **not an LLM provider**.
2. **Host adapter:** actually starts models/subagents, makes permissible browser clicks, edits source files, runs the terminal, and provides evidence. Host capabilities are checked; a self-declared capabilities JSON is not proof of access.

## Supported host guidance (capabilities, not vendor guarantees)

| Host | How to use | What must be tested |
|---|---|---|
| Codex | Load SKILL.md or install as project skill; choose real supported model IDs | Is logged-in Figma tab controllable? Can spawned subagents access it? |
| Claude Code | Read SKILL.md from the repository; execute Node scripts and local app with native shell/file tools | Is an authenticated browser automation connector actually available to this session? |
| Gemini CLI | Read SKILL.md from project; use local shell/files, Node validators | Is real viewer control available? Do not assume a Gemini chat or IDE environment shares authentication |
| Other local coding agents | Supply terminal/file/browser abilities and follow the same evidence contract | Which capabilities exist and which are merely advertised? |
| Chat-only application | Read/plan with provided screenshots or source, not claim to run code or inspect live Figma | No Node/filesystem/browser means full benchmark is BLOCKED |

Do not claim Claude Code automatically includes Claude in Chrome; do not claim Gemini CLI automatically includes a usable Figma browser. These are separate integration questions.

## Capability-first routing

1. Check filesystem, Node process and target-app runtime access. Without them, STOP before claiming implementation or verification.
2. Confirm authenticated direct read-only Figma **layer selection and Properties panel reading**. No Figma MCP/API or plugins. No direct access => `FIGMA_ACCESS_BLOCKED` and at most source/fixture review with PARTIAL.
3. Confirm subagent scheduling. If unavailable, use a single agent **sequentially**, retaining agent roles as stages; mark independent review `UNAVAILABLE`, not independently verified.
4. Direct Figma reviewer must differ from first reviewer and possess its own *actually verified* access. Two prompts to the same model or screenshot-based review do not count.
5. Configure each role with **host-provided model IDs** or inherit the current model. Never hardcode Sol/Luna/Astra across vendors, and never silently enable premium models. Obtain explicit approval for expensive/escalated models.
6. Run evidence-bound validators and report PASS/PARTIAL/BLOCKED based on the same rules across hosts. A tool limitation is not a design failure and must not be silently downgraded to PASS.

## Files and launch

Copy `config/host-capabilities.example.json` into the **target app's ignored** `.design-qa/host-capabilities.json` and update only observed abilities. Use:

```bash
node /path/to/codex-pm-killer/scripts/host-preflight.mjs --config .design-qa/host-capabilities.json
```

The CLI outputs the possible roles and blockers as JSON and exits non-zero if complete fidelity work is impossible. No hosted browser is launched, no Figma is accessed, and no models are spawned by this CLI. Existing v6 orchestrator and context commands remain useful as **coordination and evidence gates**, but host-specific agent invocation must be done via supported tools.

## Model selection by role, not vendor

- Figma Inspector: browser interaction + spatial/structural reasoning; avoid passing DOM findings before source observation.
- DOM Inspector: browser/runtime and precise measurements, can use a smaller capable model.
- Difference Analyst: accurate matching, error categorization and causal analysis.
- UI Fixer: repo editing + app tests, only role allowed to write product source.
- Independent Reviewer: separate real viewer access; when unavailable, only secondary evidence review is possible.
- MAIN: schedules dependencies, checks cost/credits using available host data, maintains evidence and final scope status.

The coordinator only has **estimated abstract budget units**; it cannot read vendor billing. Do not claim cross-provider cost equivalence or automatic model switching.

## Privacy

Keep authenticated URLs, screenshots, design evidence and app source outside the public skill repository in `.design-qa`. Avoid copying proprietary information into public knowledge files.
