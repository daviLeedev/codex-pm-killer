# codex-pm-killer

**View-only Figma browser → real DOM region mapping → strict visual/behavioral QA → reusable failure-pattern knowledge.**

Use with Codex's *currently authenticated in-app browser*. **No Figma MCP, Figma API, Dev Mode subscription, or Figma plugin.**

## Version history / 패치노트

새 버전의 **실제 코드 변경**, **검증 범위**, **아직 지원하지 않는 기능**을 함께 기록합니다. 최신 버전이 위에 오며 각 버전의 변경 내용은 누적 보존합니다.

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

## Install in Codex

```bash
git clone https://github.com/daviLeedev/codex-pm-killer.git ~/.agents/skills/codex-pm-killer
# If Codex uses a project-local skills folder, clone there instead:
# git clone ... <your-project>/.agents/skills/codex-pm-killer
```

Invoke in Codex: `$codex-pm-killer detail-fix: inspect the open view-only Figma tab, map each visual region to the real app DOM, measure, fix, independently re-audit, and record anonymized learning candidates.`

**Prerequisite:** Current Codex browser must actually expose clicking/selecting Figma layers and reading the right Properties panel. Installing this skill does not grant browser permissions or access to another logged-in tab.

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
