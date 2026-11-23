# 스텝OS (StepOS)

스텝OS는 운영체제 문제를 한 단계씩 시뮬레이션하는 웹 앱입니다. CPU 스케줄링 6종(FCFS, SJF, SRTF, HRN, RR, 우선순위)과 페이지 교체 3종(FIFO, LRU, OPT)을 지원하고, 단계마다 무엇을 왜 골랐는지 보여 줍니다.

- 미리보기: https://claude.ai/artifact/95GVQjSwwz5LX2S91ctDgX (공유받은 사람만 열 수 있음)
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

## 테스트 돌리기

엔진 테스트는 Silberschatz·Stallings 교재 예제의 평균 대기 시간, 평균 반환 시간, 페이지 부재 횟수를 확인합니다.

```bash
npm test
```

모두 통과하면 마지막에 다음 줄이 나옵니다.

```text
      Tests  20 passed (20)
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
- `src/lib/describe.ts`: 단계 기록을 그대로 옮긴 기본 설명 문장
- `src/app/page.tsx`: 입력 화면
- `src/app/simulate/`: 시뮬레이션 화면
- `preview/`: 미리보기 HTML 빌드 스크립트
