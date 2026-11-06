# Codex PM Killer — 설치 및 실행

1. `codex-pm-killer` 폴더를 `~/.agents/skills/codex-pm-killer/` 또는 작업 저장소의 `.agents/skills/codex-pm-killer/`에 배치합니다.
2. Codex에서 `$codex-pm-killer`를 호출합니다.
3. 기존 Figma 읽기 전용 탭을 열어두고, 비교할 앱 URL/페이지 범위를 지정합니다.
4. 먼저 `node scripts/find-relevant-patterns.mjs --query "화면/오류 증상"`으로 과거 실패 패턴을 찾고, 해당 검사 규칙을 체크리스트에 포함합니다.
5. Figma 시각 영역 ↔ 실제 DOM 영역 매핑 및 실측 비교 후 수정을 진행하고, 전체 2차 검수 및 증거 게이트를 통과해야 합니다.
6. 검증 후 `extract-learning-candidates.mjs`로 후보를 만들고, 민감정보 제거 및 사람/에이전트 검토 후 `ingest-reviewed-case.mjs`로 공통 지식 저장소에 기록합니다.
7. 지식이 다른 프로젝트에서 재사용되려면 이 스킬 저장소에 **실제 Git commit/push**하고 새 작업 환경에서 pull해야 합니다. 에이전트가 자동으로 학습하거나 계정 전체에 즉시 전파되는 구조는 아닙니다.

## Codex에 넣을 지시 예시

> `$codex-pm-killer`의 `detail-fix`를 실행해. Figma MCP/API는 사용하지 마. 로그인된 Figma 읽기 전용 브라우저에서 레이어를 직접 확인하고 시각 영역별로 실제 웹 DOM과 매핑해. 과거 지식은 오류 체크리스트에만 적용하고, 디자인 수치는 이번 Figma에서 다시 직접 읽어. 실제 좌표·타이포·부모/형제·줄바꿈 경계·상태 전이를 검증해. 전수 2차 검수 결과와 미확인 항목을 분리해 보고하고, 신규 학습 후보는 개인정보·프로젝트 정보를 제거한 뒤 남겨줘.`

## 주의

새 GitHub 저장소를 생성한 다음 이 폴더를 루트로 업로드하면 됩니다. 이 패키지에는 고객사 프로젝트 소스나 실제 Figma 파일이 포함되어 있지 않습니다.