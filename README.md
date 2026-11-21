# 스텝OS (StepOS)

운영체제 문제(CPU 스케줄링 6종, 페이지 교체 3종)를 한 단계씩 시뮬레이션하고, 각 단계의 이유를 설명하는 웹 앱.

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 엔진 테스트 (교재 예제)
npm run build
```

## 구조

- `src/engine/` 시뮬레이션 엔진 (순수 TypeScript, 정답 기준)
  - `scheduling.ts` FCFS, SJF, SRTF, HRN, RR, 우선순위(선점/비선점)
  - `paging.ts` FIFO, LRU, OPT
  - `diagnose.ts` 내 풀이와 엔진 결과에서 처음 어긋난 단계 찾기
  - `engine.test.ts` Silberschatz, Stallings 예제 테스트
- `src/lib/schema.ts` 문제 조건 형식 (zod). AI 해석 결과와 직접 입력 모두 이걸로 검증
- `src/lib/describe.ts` 엔진 기록을 그대로 옮긴 기본 설명 문장
- `src/app/page.tsx` 입력 화면, `src/app/simulate/` 시뮬레이션 화면

엔진은 각 단계에 비교한 값(`reason.candidates`)을 남긴다. LLM 설명은 이 값만 근거로 만든다.
