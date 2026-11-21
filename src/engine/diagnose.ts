import type { GanttSegment, PagingTrace, SchedulingTrace } from "./types";

// 내 풀이와 엔진 결과를 비교해 처음 어긋난 지점을 코드로 판정한다.
// 원인 설명은 이 결과를 받아 LLM이 한다.

export type SchedMismatch = {
  index: number; // 간트 구간 순번
  expected: GanttSegment | null;
  actual: GanttSegment | null;
  stepIndex: number; // 엔진 Step 중 그 시각의 것 (화면에서 바로 이동용)
};

// 사용자 간트: 시각을 모르면 start/end를 생략하고 실행 순서만 비교한다.
export type UserSegment = { id: string | null; start?: number; end?: number };

export function diagnoseScheduling(trace: SchedulingTrace, user: UserSegment[]): SchedMismatch | null {
  const n = Math.max(trace.gantt.length, user.length);
  for (let i = 0; i < n; i++) {
    const e = trace.gantt[i] ?? null;
    const u = user[i] ?? null;
    const same =
      e &&
      u &&
      e.id === u.id &&
      (u.start === undefined || u.start === e.start) &&
      (u.end === undefined || u.end === e.end);
    if (!same) {
      const time = e?.start ?? trace.gantt.at(-1)!.end;
      const stepIndex = Math.max(0, trace.steps.findLastIndex((s) => s.time <= time));
      return {
        index: i,
        expected: e,
        actual: u && { id: u.id, start: u.start ?? NaN, end: u.end ?? NaN },
        stepIndex,
      };
    }
  }
  return null;
}

export type PagingMismatch = {
  index: number; // 참조열 위치 = Step 순번
  expectedFrames: (number | null)[];
  actualFrames: (number | null)[] | null;
  expectedHit: boolean;
  actualHit: boolean | null;
};

// 프레임 상태는 순서 무관(집합)으로 비교한다. 교재마다 프레임 칸 배치가 다르기 때문.
export function diagnosePaging(
  trace: PagingTrace,
  user: { frames?: (number | null)[]; hit?: boolean }[],
): PagingMismatch | null {
  const asSet = (f: (number | null)[]) => [...f].filter((x) => x !== null).sort((a, b) => a! - b!).join(",");
  for (let i = 0; i < trace.steps.length; i++) {
    const s = trace.steps[i];
    const u = user[i];
    const framesOk = !u?.frames || asSet(u.frames) === asSet(s.frames);
    const hitOk = u?.hit === undefined || u.hit === s.hit;
    if (!u || !framesOk || !hitOk) {
      return {
        index: i,
        expectedFrames: s.frames,
        actualFrames: u?.frames ?? null,
        expectedHit: s.hit,
        actualHit: u?.hit ?? null,
      };
    }
  }
  return null;
}
