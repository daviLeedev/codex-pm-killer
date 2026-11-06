# GitHub 게시와 Codex 설치

GitHub 저장소: https://github.com/daviLeedev/codex-pm-killer

## 프로젝트 로컬 설치
```bash
mkdir -p .agents/skills
git clone https://github.com/daviLeedev/codex-pm-killer.git .agents/skills/codex-pm-killer
```

Codex에서 `$codex-pm-killer detail-fix`를 호출합니다. 이미 로그인된 인앱 Figma 탭을 사용하고 Figma MCP/API는 호출하지 않습니다.

## 경험 축적
프로젝트별 검수 증거는 프로젝트의 `.design-qa/` 폴더에서 관리합니다. 공통화할 수 있는 실패 패턴만 비식별화하여 `knowledge/`에 반영합니다. 자동으로 AI 모델이 훈련되는 것은 아닙니다.

공개 저장소이므로 내부 고객 정보, 실제 Figma 파일 주소, 스크린샷, 로그인 세션, API 비밀값을 커밋하지 않습니다. 지식 변경은 코드 리뷰 및 검증 후 커밋합니다.
