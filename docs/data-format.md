# 문제 조건과 단계 기록 형식

이 문서는 엔진에 넣는 **문제 조건**(`ProblemSpec`)과 엔진이 돌려주는 **단계 기록**(`Trace`)의 형식을 설명합니다. AI 문제 해석, 단계 설명, 화면 구현이 모두 이 형식을 기준으로 합니다.

- 형식 정의: `src/lib/schema.ts` (zod 스키마)
- 단계 기록 타입: `src/engine/types.ts`
- 엔진 호출: `simulate(spec)` (`src/engine/index.ts`)

## 문제 조건 검증하기

AI가 만든 문제 조건이든 직접 입력한 조건이든, 엔진에 넣기 전에 `ProblemSpecSchema`로 검증합니다. 빠진 규칙 옵션에는 이때 기본값이 채워집니다.

```ts
import { ProblemSpecSchema } from "@/lib/schema";
import { simulate } from "@/engine";

const result = ProblemSpecSchema.safeParse(input);
if (!result.success) {
  // result.error.issues[i].message: "RR에는 타임 퀀텀이 필요합니다" 등
} else {
  const trace = simulate(result.data);
}
```

## CPU 스케줄링 문제 조건

```json
{
  "kind": "scheduling",
  "algorithm": "RR",
  "quantum": 4,
  "processes": [
    { "id": "P1", "arrival": 0, "burst": 24 },
    { "id": "P2", "arrival": 0, "burst": 3 },
    { "id": "P3", "arrival": 0, "burst": 3 }
  ],
  "rules": { "rrArrivalFirst": true },
  "assumptions": ["동시 도착 시 입력 순서대로 처리"]
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `kind` | `"scheduling"` | 예 | 문제 종류 |
| `algorithm` | `FCFS` `SJF` `SRTF` `HRN` `RR` `PRIORITY` | 예 | SJF는 비선점, SRTF는 선점 |
| `processes` | 배열 (1~26개) | 예 | 아래 프로세스 필드 |
| `quantum` | 정수 ≥ 1 | RR이면 예 | 타임 퀀텀 |
| `rules` | 객체 | 아니요 | 규칙 옵션. 빠진 값은 기본값 |
| `assumptions` | 문자열 배열 | 아니요 | 문제에 없어서 적용한 가정. 화면에 그대로 표시 |

프로세스 필드:

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | 문자열 | 프로세스 이름. 중복 불가 |
| `arrival` | 정수 ≥ 0 | 도착 시각 |
| `burst` | 정수 ≥ 1 | 실행 시간 |
| `priority` | 정수 | `PRIORITY`일 때 필수 |

규칙 옵션(`rules`):

| 필드 | 기본값 | 설명 |
|---|---|---|
| `tieBreak` | `"input"` | 비교값이 같을 때 순서. `"input"`은 입력 순서, `"id"`는 이름 순 |
| `rrArrivalFirst` | `true` | RR에서 같은 시각에 도착한 프로세스를 퀀텀이 끝난 프로세스보다 큐 앞에 넣음 |
| `lowerIsHigher` | `true` | 우선순위 숫자가 작을수록 높음 |
| `preemptive` | `false` | 우선순위 스케줄링의 선점 여부 |

## 페이지 교체 문제 조건

```json
{
  "kind": "paging",
  "algorithm": "LRU",
  "frames": 3,
  "references": [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `kind` | `"paging"` | 문제 종류 |
| `algorithm` | `FIFO` `LRU` `OPT` | 교체 알고리즘 |
| `frames` | 정수 1~10 | 프레임 수 |
| `references` | 정수 배열 (1~100개) | 참조열 |
| `assumptions` | 문자열 배열 | 적용한 가정 |

## 단계 기록 읽기

`simulate()`는 단계 배열 `steps`와 결과 지표를 돌려줍니다. 화면은 `steps[i]` 하나를 한 단계로 보여 줍니다.

### CPU 스케줄링 (`SchedulingTrace`)

| 필드 | 설명 |
|---|---|
| `steps` | 이벤트가 있는 시각마다 하나 |
| `gantt` | 간트 구간 `{ id, start, end }`. `id`가 `null`이면 CPU가 쉼 |
| `processes` | 프로세스별 완료·반환·대기·응답 시간 |
| `avgWaiting`, `avgTurnaround`, `avgResponse` | 평균값 |

단계(`SchedStep`) 하나에는 다음 값이 들어 있습니다.

| 필드 | 설명 |
|---|---|
| `time` | 시각 |
| `events` | 그 시각에 일어난 일. 순서는 완료·퀀텀 만료 → 도착 → 선점 → 선택 |
| `running` | 이 시각부터 실행되는 프로세스 |
| `readyQueue` | 준비 큐 (실행 중인 프로세스 제외, 앞이 먼저) |
| `remaining` | 프로세스별 남은 실행 시간 |

이벤트 종류: `arrive`(도착), `dispatch`(선택), `preempt`(선점, `cause`가 `"quantum"` 또는 `"better"`), `complete`(완료), `idle`(CPU 쉼)

### 페이지 교체 (`PagingTrace`)

참조 하나가 단계 하나입니다.

| 필드 | 설명 |
|---|---|
| `index` | 참조열 위치 (0부터) |
| `page` | 참조한 페이지 |
| `hit` | 적중 여부 |
| `slot` | 적중하거나 적재된 프레임 번호 (0부터) |
| `victim` | 교체되어 나간 페이지. 없으면 `null` |
| `frames` | 처리 후 프레임 상태 |
| `reason` | 교체가 일어났을 때만 있음 |

## 선택 이유(`reason`)로 설명 만들기

선택(`dispatch`), 비교에 의한 선점(`preempt`), 페이지 교체에는 `reason`이 붙습니다.

```json
{
  "rule": "응답 비율 (대기 시간 + 실행 시간) / 실행 시간이 가장 큰 프로세스",
  "metric": "responseRatio",
  "candidates": [
    { "id": "D", "value": 2.4 },
    { "id": "E", "value": 3.5 }
  ],
  "chosen": "E"
}
```

| `metric` | 비교한 값 | 고르는 쪽 |
|---|---|---|
| `queueOrder` | 준비 큐 위치 | 맨 앞 (FCFS, RR) |
| `burst` | 실행 시간 | 가장 작은 값 (SJF) |
| `remaining` | 남은 시간 | 가장 작은 값 (SRTF) |
| `responseRatio` | 응답 비율 | 가장 큰 값 (HRN) |
| `priority` | 우선순위 숫자 | `lowerIsHigher`에 따름 |
| `loadedAt` | 적재된 참조 위치 | 가장 먼저 (FIFO) |
| `lastUsed` | 마지막 사용 위치 | 가장 오래전 (LRU) |
| `nextUse` | 다음 사용 위치. `null`이면 다시 안 쓰임 | 가장 늦게 (OPT) |

LLM 설명은 반드시 `reason`의 값만 근거로 씁니다. 숫자를 새로 계산하거나 지어내지 않습니다. 화면의 수치는 항상 엔진 값을 그대로 표시합니다. LLM이 없을 때 쓰는 기본 문장은 `src/lib/describe.ts`가 만듭니다.

## 내 풀이 진단하기

`diagnoseScheduling(trace, user)`와 `diagnosePaging(trace, user)`는 학생 풀이와 엔진 결과를 비교해서 처음 어긋난 위치를 돌려줍니다. 모두 같으면 `null`을 돌려줍니다.

- 스케줄링: 간트 구간 배열 `[{ id, start?, end? }]`을 비교합니다. 시각을 생략하면 실행 순서만 비교합니다.
- 페이지 교체: 참조마다 `{ frames?, hit? }`를 비교합니다. 프레임 상태는 칸 순서와 관계없이 비교합니다.
