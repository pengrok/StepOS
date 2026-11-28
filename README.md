# 스텝OS (StepOS)

스텝OS는 운영체제 문제를 한 단계씩 시뮬레이션하는 웹 앱입니다. CPU 스케줄링 6종(FCFS, SJF, SRTF, HRN, RR, 우선순위)과 페이지 교체 3종(FIFO, LRU, OPT)을 지원하고, 단계마다 무엇을 왜 골랐는지 보여 줍니다.

- 미리보기: https://claude.ai/artifact/95GVQjSwwz5LX2S91ctDgX (링크가 있으면 누구나 열 수 있음)
- 진행 상황과 결정 기록: [docs/progress.md](docs/progress.md)
- 문제 조건·단계 기록 형식: [docs/data-format.md](docs/data-format.md)

## 실행하기

준비물: Node.js 20.9 이상

1. 의존 패키지를 설치합니다.

   ```bash
   npm install
   ```

2. 개발 서버를 실행합니다.

   ```bash
   npm run dev
   ```

3. 브라우저에서 `http://localhost:3000`을 엽니다. 입력 화면에 SRTF 예제가 들어 있습니다.
4. **한 단계씩 풀어 보기**를 누릅니다. 간트 차트가 시각 0부터 그려지면 정상입니다.

## AI 문제 해석 켜기

**AI로 조건 채우기** 버튼은 문제 글이나 사진을 AI(Gemini 또는 GPT)에 보내 오른쪽 조건 표를 채웁니다. API 키가 없으면 버튼을 눌러도 "아직 설정되지 않았습니다"라는 안내만 나오고, 조건은 표에 직접 입력합니다.

준비물: Google AI Studio(Gemini) 또는 OpenAI 플랫폼(GPT)의 API 키

1. 설정 파일을 복사합니다.

   ```bash
   cp .env.example .env.local
   ```

2. `.env.local`에 쓰는 쪽의 키를 하나 넣습니다. 예를 들어 Gemini를 쓰면 `GOOGLE_GENERATIVE_AI_API_KEY=` 뒤에 키를 붙입니다. `.env.local`은 git에 올라가지 않습니다. 키를 코드나 채팅에 붙여 넣지 않습니다.
3. 개발 서버를 다시 실행합니다(`npm run dev`).
4. 문제 글을 넣고 **AI로 조건 채우기**를 누릅니다. "AI가 오른쪽 조건 표를 채웠습니다"라는 안내와 함께 표가 채워지면 정상입니다.

AI가 채운 조건은 항상 오른쪽 표에서 확인하고 고친 뒤 실행합니다. 정답 계산은 AI가 아니라 엔진이 합니다.

Vercel에 배포할 때는 같은 이름의 환경변수를 Vercel 프로젝트 설정에 넣습니다. 미리보기 링크(claude.ai 페이지)에서는 외부 API를 부를 수 없어서 AI 문제 해석이 동작하지 않습니다.

사용량 제한: 접속 주소(IP)마다 10분에 10번, 하루 전체 토큰 100만 개까지 AI를 부릅니다. 값은 `.env.local`에서 바꿉니다. 로그인이 없어서 IP 기준이고, 서버 인스턴스마다 따로 셉니다.

## 테스트 돌리기

엔진 테스트는 Silberschatz·Stallings 교재 예제의 평균 대기 시간, 평균 반환 시간, 페이지 부재 횟수를 확인합니다. 해설 테스트는 단계별 해설 문장이 엔진 값과 맞는지 확인합니다. AI 해석 테스트는 실제 AI 대신 정해진 응답을 돌려주는 가짜 모델로 형식 검증, 재요청, 거절, 사용량 제한을 확인합니다(API 키 필요 없음).

```bash
npm test
```

모두 통과하면 마지막에 다음 줄이 나옵니다.

```text
      Tests  37 passed (37)
```

엔진(`src/engine/`)을 고친 뒤에는 이 테스트가 통과하는지 확인합니다. 배포 전에는 `npm run build`도 실행합니다.

## 미리보기 다시 올리기

미리보기는 입력 화면과 시뮬레이션 화면을 HTML 파일 하나로 묶은 복사본입니다. 화면이나 엔진을 고쳐도 자동으로 바뀌지 않습니다.

1. HTML 파일을 만듭니다.

   ```bash
   npm run preview -- stepos-preview.html
   ```

   성공하면 `stepos-preview.html (484 KB)`처럼 파일 이름과 크기가 나옵니다.

2. Claude에게 이 파일을 위 미리보기 링크에 다시 올려 달라고 요청합니다. 같은 링크가 새 내용으로 바뀝니다.

## 규칙 옵션 바꾸기

수업마다 다른 규칙은 입력 화면의 체크박스로 바꿉니다. 문제에 규칙이 없을 때 쓰는 기본값은 다음과 같습니다.

| 규칙 옵션 | 기본값 | 필드 |
|---|---|---|
| 동시 도착 순서 | 입력한 순서 | `tieBreak: "input"` |
| RR 큐 삽입 순서 | 새로 도착한 프로세스를 퀀텀이 끝난 프로세스보다 앞에 | `rrArrivalFirst: true` |
| 우선순위 숫자 방향 | 숫자가 작을수록 높음 | `lowerIsHigher: true` |
| 우선순위 선점 | 비선점 | `preemptive: false` |

기본값을 바꾸려면 `src/lib/schema.ts`의 `SchedulingRulesSchema`를 고칩니다.

## 폴더 구조

- `src/engine/`: 시뮬레이션 엔진. React와 LLM에 의존하지 않는 TypeScript 코드이며, 앱의 정답 기준입니다.
  - `scheduling.ts`: CPU 스케줄링 6종
  - `paging.ts`: 페이지 교체 3종
  - `diagnose.ts`: 내 풀이와 엔진 결과를 비교해 처음 어긋난 단계를 찾음
  - `engine.test.ts`: 교재 예제 테스트
- `src/lib/schema.ts`: 문제 조건 형식(zod). AI 해석 결과와 직접 입력을 모두 이 형식으로 검증합니다.
- `src/lib/describe.ts`: 단계 기록을 한 줄로 옮긴 요약 문장
- `src/lib/explain.ts`: 시뮬레이션 화면 아래의 단계별 해설(무슨 일이 있었나, 왜 그렇게 되나, 준비 큐 순서, 다음 단계). 엔진 값만으로 문장을 만듭니다.
- `src/app/page.tsx`: 입력 화면
- `src/app/simulate/`: 시뮬레이션 화면
- `src/lib/parseProblem.ts`: AI 문제 해석. AI 출력을 문제 조건 형식으로 검증하고, 실패하면 한 번 다시 요청합니다.
- `src/lib/llm.ts`: AI 공급사(Gemini, GPT) 선택
- `src/lib/rateLimit.ts`: AI 사용량 제한
- `src/app/api/parse/route.ts`: AI 문제 해석 서버 경로. API 키는 서버에만 있습니다.
- `preview/`: 미리보기 HTML 빌드 스크립트
