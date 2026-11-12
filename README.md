# codex-pm-killer

**View-only Figma browser → real DOM region mapping → strict visual/behavioral QA → reusable failure-pattern knowledge.**

**Provider-neutral QA core:** runs under Codex, Claude Code, Gemini CLI or any capable terminal agent. The **host must supply real project file access, Node.js execution and an authenticated read-only Figma viewer** for direct design inspection. No Figma MCP/API/plugin/Dev Mode; unsupported capabilities are reported as BLOCKED, never invented.

## Version history / 패치노트

새 버전의 **실제 코드 변경**, **검증 범위**, **아직 지원하지 않는 기능**을 함께 기록합니다. 최신 버전이 위에 오며 각 버전의 변경 내용은 누적 보존합니다.

### v6.3.2 — Benchmark Readiness & Shared Asset Integrity (2026-11-12)

**Added**
- `benchmarks/v6.3/asset-pack.mjs`: A/B/C 공통 대체 이미지의 SHA-256, 실제 크기, 출처·라이선스 검사와 변조 방지 잠금.
- `benchmarks/v6.3/readiness-gate.mjs`: 동결 Figma 증거, 필수 영역 매핑, 실제 브라우저 검증, $5 승인 예산을 사전 검사하는 실행 게이트.
- 실제 Chromium 기반 `v6.3.2-browser-selftest.mjs`, 필수 영역·폰트·에셋 단위 테스트, 준비도 게이트 테스트.

**Changed**
- 필수 UI 영역 누락·숨김·중복은 평가 가능률이 95%를 넘더라도 전체 PASS 금지.
- 실제 사용 글꼴은 Chromium CDP로 조회하고, CSS 폰트 선언만으로 글꼴 일치를 인정하지 않음.
- 이미지 로딩 대기·재캡처 안정성·고정(sticky) 요소의 레이아웃 흐름·대체 이미지 ID 검증 보강.

**Validation**
- 기존 v4–v6.3.1 검사와 v6.3.2 단위/준비도 합성 테스트 통과.
- 통제된 HTML fixture에서 Chromium CDP 폰트·이미지·간격·필수 버튼 누락 등을 실제 브라우저로 검증. CI에 브라우저 검사 작업 추가.

**Limitations**
- 대체 이미지는 공통 자산 사용·크롭·로딩 검증용이며 원본 Figma 사진의 픽셀 일치를 증명하지 않음.
- 브라우저 fixture는 실제 Algolia Vue 앱 E2E 검증이 아니며, 실제 Figma 150개 항목의 95% 검증 목표는 아직 미확인.
- 새 유료 API 벤치마크를 실행하거나 과거 결과를 새 점수로 덮어쓰지 않음.

### v6.3.1 — Benchmark Evaluation Fixes & History (2026-11-12)

**Added**
- 입력 placeholder의 실제 표시 문구와 `::placeholder` 색상 수집 및 `placeholder_text`, `placeholder_color` 비교.
- `asset_kind`를 통한 사진·벡터·플레이스홀더 유형 구분(정확한 이미지 픽셀 동일성을 의미하지 않음).
- 별도 승인 $5 한도와 실행 원장의 불일치를 잡는 `verify-approved-budget.mjs`.
- `benchmarks/history/`에 비식별화된 Algolia v6.3 실험 집계·증거 ZIP SHA-256·남은 검증 한계를 보존.

**Changed**
- `display:block`에서 무관한 기본 `flexDirection:row`를 사용하지 않도록 실제 렌더링 간격 축을 수정. Flex는 방향에 맞춰 계산하고, Grid는 row/column을 명시하지 않으면 추측하지 않음.
- 과거 동결된 A/B/C 점수는 재평가 없이 수정하지 않음. 향후 새 캡처로 재측정한 결과는 새 실행 ID로 기록.

**Validation**
- 기존 20개 합성 오류 주입 테스트 유지, v6.3.1 새 속성·축 테스트 17건, 예산 승인 테스트 6건, 공개 이력 검증 테스트 5건.
- GitHub Actions에서 v4~v6.3 기존 테스트와 이번 테스트를 함께 실행.

**Limitations**
- 실제 Figma 원본과 새 앱을 대상으로 v6.3.1을 재채점하지 않았으므로 95% 신뢰 가능한 평가 가능률 달성은 미확정.
- 실시간 Playwright 수집에는 실행 프로젝트의 브라우저 도구가 필요하며, 자산 유형 일치는 정확한 사진·SVG 윤곽 일치가 아님.
- API 예산 정책 검사는 로컬 신고값의 일관성만 확인하며 승인 진위와 외부 청구를 보증하지 않음.

### v6.3.0 — Benchmark Reliability & Visual Fidelity (2026-11-12)

**Added**
- `benchmarks/v6.3/evaluate.mjs`: 크기·실제 간격·색상·타이포그래피·문구·자식 수·아이콘·이미지 존재를 검사하고 미관측 값은 `NOT_EVALUABLE`로 분류.
- `freeze-truth.mjs`와 `capture-runtime.mjs`: 기존 150개 assertion과 Figma 증거 SHA-256을 고정하고, 실제 Vue DOM의 박스·텍스트·스타일·스크린샷을 캡처.
- `budget-journal.mjs`: $5 예약 한도, 유료 요청 ID 중복 차단, raw 응답 선저장, 미정산·과금 불명확 상태에서 추가 요청 차단.
- Track I(구현 정확도) / Track II(오류 검출) 분리 프로토콜과 자체 변형 테스트.

**Changed**
- 기존 150개 검사의 원본 분모와 평가불가 항목을 보존하며, 검증 가능한 비율과 확인한 일치율을 분리 보고.
- 모델이 작성한 PASS는 증거 없는 속성의 자동 통과를 의미하지 않음.

**Validation**
- 합성 오류 20종 모두 검출, 정상 대조 20종에서 오탐 0. API 예산·원문 보존 자체 테스트 20 assertions 및 기존 v4–v6 테스트.
- 기존 Algolia 150건의 개수는 재현했지만 직접 Figma 속성 증거 및 해시가 부족해 원본 품질 평가 `PARTIAL` 판정 유지.

**Limitations**
- 실제 Figma에 자동 로그인하거나 Figma MCP/API를 호출하지 않음. 현장 95% 커버리지 및 아이콘 윤곽의 픽셀 완전 일치는 입증되지 않음.
- API 자체 호출은 외부 러너의 역할. 소프트웨어 $5 예약은 공급자 청구 금액의 절대 보장이 아님.

### v6.2.0 — Provider-Neutral Agent Execution (2026-11-10)

**Added**
- `references/provider-neutral-execution.md`: Codex·Claude Code·Gemini CLI·기타 CLI 에이전트의 역할별 실행 계약과 환경별 폴백.
- `config/host-capabilities.example.json` 및 `scripts/host-preflight.mjs`: 모델 이름이 아닌 실제 브라우저·파일·서브에이전트 권한으로 실행 가능 범위를 진단.
- `tests/host-preflight-selftest.mjs`: 사용 가능한 도구, 브라우저 미접근, 서브에이전트 부재 등 시나리오 검증.

**Changed**
- 메인 스킬 설명에서 Codex 전용 브라우저를 필수 전제로 하지 않음. 예시 모델은 Codex 전용 기본값이며, 다른 플랫폼에서는 해당 플랫폼이 실제 지원하는 모델 ID를 사용.
- 오케스트레이터와 v5/v6 검증 스크립트는 플랫폼과 무관한 Node.js 도구이며, 실제 에이전트 생성·모델 선택·브라우저 접근은 호스트 책임이라고 명시.

**Validation**
- `node tests/host-preflight-selftest.mjs` 및 기존 v4~v6.1 CI 테스트 실행.
- `node scripts/check-release-notes.mjs`로 최신 VERSION과 패치노트 일치 확인.

**Limitations**
- 호스트 진단은 입력된 capabilities에 의존하며 권한·로그인 여부를 독립적으로 인증하지 못함.
- 브라우저 접근이 없는 환경은 실제 Figma 속성 검사나 직접 독립 검수가 불가능하며, 공통 검사 스크립트만 실행 가능함.

### v6.1.0 — Audit Provenance & Failure Triage (2026-11-10)

**Added**
- 검증 환경 등급(`REAL_APP_RUNTIME` / `ISOLATED_VUE_FIXTURE` / `SOURCE_ONLY`)에 따른 검수 결과 분리와 격리 화면의 실 앱 PASS 승격 차단.
- `scripts/v6-audit-provenance.mjs`: 실제 수치 재계산, 파일 SHA-256 연결, 에이전트 실행 원장 점검, 테스트 실패 분류, `PARTIAL` 후속 작업 생성.
- `assets/v6-audit-manifest.template.json`, `references/v6.1-audit-provenance.md`, 실패 주입 합성 테스트 16종.

**Changed**
- v6 오케스트레이터를 사용했다는 서술만으로 멀티 에이전트 실행/독립 검수를 인정하지 않음.
- 디자인 기준 충돌·테스트 인프라 오류·기능 회귀를 구분하고, 실패 상태를 최종 보고서에 남김.

**Validation**
- `node tests/v6-audit-provenance-selftest.mjs`로 격리 화면 오인, 잘못된 PASS, 증거 변조, 실패 은폐, 독립 검수 부재 등을 검출.
- 기존 v4/v5/v6 CI 테스트와 패치노트 검증을 유지.

**Limitations**
- 서명되지 않은 자체 보고 자료와 SHA-256으로는 캡처의 진위·완전한 Figma 조사·실제 모델 실행 여부를 독립적으로 증명할 수 없음.
- 실제 HKFIRE 내부망·iOS·API 및 여러 모델의 라이브 E2E 실행은 별도 검증 대상.

### v6.0.0 — Balanced Multi-Agent & Smart Context (2026-11-10)

**Added**
- MAIN Orchestrator와 Figma Inspector, DOM Inspector, Difference Analyst, UI Fixer, Independent Reviewer의 역할별 작업 계약.
- Figma/DOM 병렬 조사, 후속 작업 의존성, 브라우저 단독 점유 잠금, 동시 실행 수 제한, 예산 초과 및 Astra 무단 에스컬레이션 차단.
- `scripts/v6-orchestrator.mjs`, `scripts/v6-generate-agents.mjs`, 모델 매핑·균형형 정책 설정.
- `scripts/v6-context.mjs`의 역할별 컨텍스트 팩, 증거 해시, 체크포인트/재개, 메인·서브 간 정보 격리.

**Changed**
- 코드 수정은 Fixer에만 맡기고, Figma 원본 조사와 실제 DOM 측정은 별도 근거로 수집한 다음 비교.
- 모든 PASS 판정은 기존 v4/v5 검증기와 증거에 연결하고, 미확인 범위는 PARTIAL/BLOCKED로 보고.

**Validation**
- `node tests/v6-selftest.mjs`, `node tests/v6-config-selftest.mjs`, `node tests/v6-context-selftest.mjs`의 합성 테스트 및 기존 v4/v5 회귀 테스트.
- `node scripts/check-release-notes.mjs`로 VERSION과 README 패치노트의 일치 여부 검사.

**Limitations**
- 조정 엔진이 Codex 서브에이전트를 직접 생성하거나 실제 모델을 자동 전환하지는 않음. 브라우저 소유권은 협력적 잠금.
- 예산은 추정 작업 단위이며 실제 크레딧 사용량이 아님. 라이브 Figma/앱 전체 멀티에이전트 E2E 검증은 별도 필요함.

### v5.0.0 — Strict Design Audit (2026-11-10)

**Added**
- 실제 앱 DOM 스냅샷 기반 영역 인벤토리와 Figma 읽기 전용 화면에서 수집한 레이어 인벤토리 대조.
- Figma ↔ DOM 매핑 후보 생성 및 증거 기반 승인; 미매핑·잘린 스냅샷은 완료로 인정하지 않음.
- 박스 크기, 내용 영역, 실제 경계 간격을 수치로 비교하는 검사와 독립 2차 검수 게이트.
- `scripts/v5-audit.mjs`, `references/v5-strict-audit.md`, 검수용 JSON 템플릿.

**Validation**
- `node tests/v5-selftest.mjs`에서 인위적인 누락·수치 오류를 차단하는 합성 테스트.

**Limitations**
- Figma 레이어 자체는 자동 수집하지 않으며, 로그인된 브라우저에서 직접 읽은 증거가 필요함.
- 합성 테스트 통과는 실제 제품의 픽셀 일치나 독립 검수를 증명하지 않음.

### v4.0.0 — Browser QA & Knowledge Loop (baseline)

**Added**
- Figma 읽기 전용 브라우저 조사 지침과 실제 DOM·레이아웃·이미지 비교 스크립트.
- Figma 시각 영역 ↔ DOM 영역 매핑, 반복 검수 및 근거별 PASS 제한.
- 익명화된 오류 패턴을 저장·검색·검토 후 재사용하는 Knowledge Loop.

**Limitations**
- 모델의 내부 학습이 아니라 검증된 파일·Git 기반 지식 축적이며, 실제 브라우저 접근 권한이 필요함.

**버전 갱신 규칙:** 다음 버전마다 `VERSION` 값을 올리고, 이 섹션 맨 위에 `Added / Changed / Validation / Limitations` 항목과 해당 버전의 실질적인 변경을 작성합니다. 기존 노트는 삭제하지 않습니다. 사용자/고객사 정보나 Figma 캡처는 공개 README에 기록하지 않습니다.

## Install on any capable coding agent

Clone the repository in a location readable by the agent. Node.js tools work independently of the LLM provider:

```bash
git clone https://github.com/daviLeedev/codex-pm-killer.git
node codex-pm-killer/scripts/host-preflight.mjs --config codex-pm-killer/config/host-capabilities.example.json
```

Fill the capabilities JSON from **observed host permissions**, not assumptions. Preflight warns when Figma access or independent review is unavailable. Claude Code / Gemini CLI can execute the same skill instructions as a repository document, even if their skill discovery syntax differs. See [provider-neutral execution](references/provider-neutral-execution.md).

### Codex-specific installation (optional)

```bash
git clone https://github.com/daviLeedev/codex-pm-killer.git ~/.agents/skills/codex-pm-killer
# If Codex uses a project-local skills folder, clone there instead:
# git clone ... <your-project>/.agents/skills/codex-pm-killer
```

Invoke in Codex: `$codex-pm-killer detail-fix: inspect the open view-only Figma tab, map each visual region to the real app DOM, measure, fix, independently re-audit, and record anonymized learning candidates.`

**Prerequisite:** Whichever agent host you choose must be able to select Figma layers in an authenticated read-only viewer and read Properties for direct Figma inspection. Installing this skill does not grant browser access or reuse another tool's login.

## What is automated and what is not

| Stage | Status |
| --- | --- |
| Read-only Figma layer selecting / properties | Agent-assisted browser actions; no automatic Figma parser |
| Map Figma region to app DOM | Agent-generated mapping, audited by scripts |
| Actual local DOM CSS / bounds | `scripts/capture-local.mjs` (requires Playwright installed) |
| Geometry/layout differences | `scripts/compare-layout.mjs`, `scripts/compare-region-geometry.mjs` |
| Screenshot overlay/diff | `scripts/compare-images.py` (requires Pillow) |
| Strict audit/reproduction evidence gate | `scripts/verify-detail-audit.mjs`, `scripts/verify-repro-matrix.mjs` |
| Reuse past failure patterns | `find-relevant-patterns.mjs` |
| Learn new issues | `extract-learning-candidates.mjs` → reviewed/redacted `ingest-reviewed-case.mjs` |
| Cross-session knowledge sync | Git commit/push/pull **after review**, not model training |

## Knowledge governance

`knowledge/patterns.json` stores general risk patterns, and `knowledge/cases` holds **anonymized** supporting cases. All initial knowledge is marked `HEURISTIC` based on a conversation retrospective, not independently reproduced by this repository. Never copy past Figma numeric values into a new file, or silently mark source-only results as runtime verification.

See [`references/knowledge-loop.md`](references/knowledge-loop.md), [`START_HERE_KO.md`](START_HERE_KO.md) and [`SKILL.md`](SKILL.md). Tests: `node tests/selftest.mjs && node tests/knowledge-selftest.mjs`.

## Security and publishing

Private repo is recommended until you review any customer-specific examples. `.design-qa/`, screenshots, browser storage, tokens, client identifiers, and production code must not be committed. There is no automatic Git push from the learning scripts.

**No guarantee of pixel-perfect results:** Browser access and observed Figma scopes may be partial. Passing the deterministic gate proves the *submitted evidence format and consistency*, not that an independent observer exhaustively inspected every Figma layer.

## v5: strict evidence-bound audits

New: [`references/v5-strict-audit.md`](references/v5-strict-audit.md) documents real-DOM inventory generation, suggested Figma-to-DOM matching with explicit approval, geometry and content-box validation, independent re-inspection, and a fail-closed combined gate. All new commands are in `scripts/v5-audit.mjs`. Run the synthetic mutation suite with `node tests/v5-selftest.mjs`.

**Important:** v5 does not read Figma programmatically; the logged-in Codex browser must inspect visible viewer Layers and Properties. A second sweep by the same agent is not independently verified. If these requirements cannot be met, the audit status stays PARTIAL.

## v6 — balanced multi-agent coordination

See [`references/v6-multi-agent.md`](references/v6-multi-agent.md). The coordinator (`scripts/v6-orchestrator.mjs`) implements task dependencies, atomic state serialization, exclusive browser-owner lease, capability evidence, role-specific handoff contracts, a **2-worker** admission limit, estimated work-unit budgeting and fail-closed escalation. It does **not** directly spawn Codex agents, bypass login permissions, change model selection, or charge real credits.

**Suggested default:** MAIN Sol Medium; Figma inspector Sol Medium, runtime DOM inspector a cheaper available model, Difference Analyst Sol High, UI Fixer Sol Medium; second Figma reviewer must be genuinely independent with direct access. Astra is off unless the user explicitly approves it. Model family labels are preferences, not verified Codex model IDs; generate actual project `.codex/agents` TOMLs using `scripts/v6-generate-agents.mjs` and your *available* model IDs. If direct browser sharing is unavailable, MAIN owns Figma inspection and independent direct Figma verification remains BLOCKED unless another agent gets its own viewer access.

Quick test: `node tests/v6-selftest.mjs` (synthetic invariants, not a live Figma fidelity claim).


## v6 Smart Context Engineering (role-scoped, resumable)

See [`references/v6-context-management.md`](references/v6-context-management.md). `scripts/v6-context.mjs` keeps an evidence-hashed local ledger, builds bounded task packs, separates Figma/DOM/reviewer working contexts, and creates strict hash-verified checkpoints for session resumes. `config/v6-balanced.json` **requires a current role pack for each new agent assignment**; previously generated packs must be re-issued if their source evidence changes. `config/v6-context.json` defines per-role character ceilings (not precise token or billing limits).

```bash
# In the target application's directory, AFTER v6-orchestrator init:
node /path/to/codex-pm-killer/scripts/v6-context.mjs init --workspace "$PWD"
node /path/to/codex-pm-killer/scripts/v6-context.mjs pack --workspace "$PWD" --task figma
node /path/to/codex-pm-killer/scripts/v6-context.mjs pack --workspace "$PWD" --task dom
# Repeat with difference, fixer, review, gate when each stage becomes ready.
node /path/to/codex-pm-killer/scripts/v6-context.mjs checkpoint --workspace "$PWD"
node /path/to/codex-pm-killer/scripts/v6-context.mjs resume --workspace "$PWD"
```

Validation: `node tests/v6-context-selftest.mjs`. **Context packs reduce supplied input, not necessarily total model cost**; rework rates and real usage must be measured in Codex. This is a local file-backed contract, not direct access to Codex's hidden context/compaction internals.


## Cross-platform adapters (v6.2)

The model and agent role names in older release notes are **historical defaults**, not restrictions on supported hosts. A host can execute the core scripts as long as it can access local files and Node.js; direct Figma fidelity additionally requires an authenticated viewer with usable input controls. The same evidence gate applies to Claude, Gemini and Codex. A failed capability preflight must not be misreported as a model-quality failure. See [`references/provider-neutral-execution.md`](references/provider-neutral-execution.md).


## v6.3 Benchmark tools

Implementation: [`benchmarks/v6.3/README.md`](benchmarks/v6.3/README.md). Protocol: [`references/v6.3-benchmark-protocol.md`](references/v6.3-benchmark-protocol.md). All new tests are synthetic; real Algolia Figma measurements must be provided with direct, hashed evidence. The 150-item legacy benchmark denominator must not be changed to hide UNKNOWN assertions.


## Benchmark history and evidence retention (v6.3.1)

Full Figma captures, source ZIPs, API raw output, browser sessions and screenshots must remain private. Only a redacted summary of completed runs with frozen count, actual model setup, cost estimates, known limitations and a private bundle hash can go to [benchmarks/history](benchmarks/history/README.md). Every release gets a README **patch note**, but only actual completed benchmark runs get a separate history entry. Never count synthetic fixture tests as real Figma QA wins. Historical v6.3 scores are frozen; correcting an evaluator requires a separately identified re-evaluation using actual available evidence.

## v6.3.2 readiness gate

- [Readiness & asset pack protocol](references/v6.3.2-readiness.md)
- Shared image substitutes are fixed once for all A/B/C groups. They may demonstrate correct loading and layout, **not original image visual fidelity**.
- Critical required UI regions may never silently disappear into `NOT_EVALUABLE` and still receive scoped VERIFIED.
- Evidence collection, asset-lock validation, approval against the original total $5 cap, and browser smoke must precede new paid requests.
- A real Vue runtime uses `capture-runtime.mjs --url http://localhost:...`. `--fixture-html` is for isolated browser tests only and cannot establish real app fidelity.

Tests: `node tests/v6.3.2-selftest.mjs && node tests/v6.3.2-readiness-selftest.mjs` plus `node tests/v6.3.2-browser-selftest.mjs` where Playwright Chromium is installed. No automatic Figma download, image generation or paid API calls occur in these tests.
