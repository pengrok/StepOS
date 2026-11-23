# 스텝OS 작업 메모

운영체제 문제를 한 단계씩 시뮬레이션하는 공모전용 웹 앱입니다. 먼저 다음 문서를 읽습니다.

- `README.md`: 실행, 테스트, 미리보기 다시 올리기
- `docs/data-format.md`: 문제 조건과 단계 기록 형식
- `docs/progress.md`: 진행 상황과 결정 기록

지킬 규칙:

- 정답 수치는 `src/engine/`만 계산합니다. LLM 출력에서 수치를 가져오지 않습니다.
- 엔진을 고친 뒤에는 `npm test`가 통과해야 합니다.
- AI가 만든 문제 조건은 `ProblemSpecSchema`로 검증한 뒤에만 엔진에 넣습니다.
- 화면을 고친 뒤에는 `npm run preview`로 미리보기를 다시 만들어 올립니다.
- 일을 끝내면 `docs/progress.md`의 체크리스트와 결정 기록을 갱신합니다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
