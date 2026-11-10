# codex-pm-killer

**View-only Figma browser → real DOM region mapping → strict visual/behavioral QA → reusable failure-pattern knowledge.**

Use with Codex's *currently authenticated in-app browser*. **No Figma MCP, Figma API, Dev Mode subscription, or Figma plugin.**

## Version history / 패치노트

새 버전의 **실제 코드 변경**, **검증 범위**, **아직 지원하지 않는 기능**을 함께 기록합니다. 최신 버전이 위에 오며 각 버전의 변경 내용은 누적 보존합니다.

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
