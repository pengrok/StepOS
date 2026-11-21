import { describe, expect, it } from "vitest";
import { ProblemSpecSchema } from "../lib/schema";
import { diagnosePaging, diagnoseScheduling, simulate } from "./index";
import type { PagingTrace, SchedulingTrace } from "./types";

const sched = (input: object) =>
  simulate(ProblemSpecSchema.parse({ kind: "scheduling", ...input })) as SchedulingTrace;
const paging = (input: object) => simulate(ProblemSpecSchema.parse({ kind: "paging", ...input })) as PagingTrace;
const P = (id: string, arrival: number, burst: number, priority?: number) => ({ id, arrival, burst, priority });
const order = (t: SchedulingTrace) => t.gantt.map((g) => `${g.id ?? "-"}:${g.start}-${g.end}`).join(" ");
const finish = (t: SchedulingTrace) => Object.fromEntries(t.processes.map((p) => [p.id, p.completion]));

// Silberschatz 운영체제 예제
const s3 = [P("P1", 0, 24), P("P2", 0, 3), P("P3", 0, 3)];
// Stallings 운영체제 예제 (A~E)
const stallings = [P("A", 0, 3), P("B", 2, 6), P("C", 4, 4), P("D", 6, 5), P("E", 8, 2)];

describe("CPU 스케줄링", () => {
  it("FCFS: 평균 대기 17", () => {
    const t = sched({ algorithm: "FCFS", processes: s3 });
    expect(order(t)).toBe("P1:0-24 P2:24-27 P3:27-30");
    expect(t.avgWaiting).toBe(17);
  });

  it("SJF: 평균 대기 7", () => {
    const t = sched({ algorithm: "SJF", processes: [P("P1", 0, 6), P("P2", 0, 8), P("P3", 0, 7), P("P4", 0, 3)] });
    expect(order(t)).toBe("P4:0-3 P1:3-9 P3:9-16 P2:16-24");
    expect(t.avgWaiting).toBe(7);
  });

  it("RR q=4: 평균 대기 5.67, 혼자 남은 P1 구간은 하나로 합침", () => {
    const t = sched({ algorithm: "RR", quantum: 4, processes: s3 });
    expect(order(t)).toBe("P1:0-4 P2:4-7 P3:7-10 P1:10-30");
    expect(t.avgWaiting).toBeCloseTo(17 / 3);
  });

  it("SRTF: 평균 대기 6.5 (Silberschatz)", () => {
    const t = sched({ algorithm: "SRTF", processes: [P("P1", 0, 8), P("P2", 1, 4), P("P3", 2, 9), P("P4", 3, 5)] });
    expect(order(t)).toBe("P1:0-1 P2:1-5 P4:5-10 P1:10-17 P3:17-26");
    expect(t.avgWaiting).toBe(6.5);
    const pre = t.steps.find((s) => s.time === 1)!.events.find((e) => e.type === "preempt");
    expect(pre).toMatchObject({ id: "P1", by: "P2", cause: "better" });
  });

  it("SRTF: 동점이면 먼저 도착한 프로세스 (Stallings, 평균 반환 7.2)", () => {
    const t = sched({ algorithm: "SRTF", processes: stallings });
    expect(finish(t)).toEqual({ A: 3, B: 15, C: 8, D: 20, E: 10 });
    expect(t.avgTurnaround).toBeCloseTo(7.2);
  });

  it("HRN: Stallings 예제 (평균 반환 8)", () => {
    const t = sched({ algorithm: "HRN", processes: stallings });
    expect(order(t)).toBe("A:0-3 B:3-9 C:9-13 E:13-15 D:15-20");
    expect(t.avgTurnaround).toBe(8);
    // 시각 13에서 E(3.5)가 D(2.4)보다 응답 비율이 높다
    const d = t.steps.find((s) => s.time === 13)!.events.find((e) => e.type === "dispatch")!;
    expect(d.type === "dispatch" && d.reason.candidates).toEqual([
      { id: "D", value: 2.4 },
      { id: "E", value: 3.5 },
    ]);
  });

  it("비선점 우선순위: 평균 대기 8.2 (Silberschatz)", () => {
    const procs = [P("P1", 0, 10, 3), P("P2", 0, 1, 1), P("P3", 0, 2, 4), P("P4", 0, 1, 5), P("P5", 0, 5, 2)];
    const t = sched({ algorithm: "PRIORITY", processes: procs });
    expect(order(t)).toBe("P2:0-1 P5:1-6 P1:6-16 P3:16-18 P4:18-19");
    expect(t.avgWaiting).toBe(8.2);
  });

  it("우선순위 숫자 방향과 선점 옵션", () => {
    const procs = [P("P1", 0, 5, 1), P("P2", 1, 2, 9)];
    // 숫자가 클수록 높음 + 선점형: P2가 도착 즉시 P1을 선점
    const t = sched({ algorithm: "PRIORITY", processes: procs, rules: { lowerIsHigher: false, preemptive: true } });
    expect(order(t)).toBe("P1:0-1 P2:1-3 P1:3-7");
    // 기본(작을수록 높음, 비선점): 선점 없음
    expect(order(sched({ algorithm: "PRIORITY", processes: procs }))).toBe("P1:0-5 P2:5-7");
  });

  it("RR q=1: Stallings 예제 (평균 반환 10.8)", () => {
    const t = sched({ algorithm: "RR", quantum: 1, processes: stallings });
    expect(finish(t)).toEqual({ A: 4, B: 18, C: 17, D: 20, E: 15 });
    expect(t.avgTurnaround).toBeCloseTo(10.8);
  });

  it("RR 큐 삽입 순서 옵션이 결과를 바꾼다", () => {
    // 시각 2에 P1 퀀텀 만료와 P3 도착이 동시에 일어난다
    const procs = [P("P1", 0, 4), P("P2", 1, 2), P("P3", 2, 2)];
    const first = sched({ algorithm: "RR", quantum: 2, processes: procs });
    expect(order(first)).toBe("P1:0-2 P2:2-4 P3:4-6 P1:6-8");
    const last = sched({ algorithm: "RR", quantum: 2, processes: procs, rules: { rrArrivalFirst: false } });
    expect(order(last)).toBe("P1:0-2 P2:2-4 P1:4-6 P3:6-8");
  });

  it("동시 도착 처리: 입력 순서 vs 이름 순", () => {
    const procs = [P("P2", 0, 1), P("P1", 0, 1)];
    expect(order(sched({ algorithm: "FCFS", processes: procs }))).toBe("P2:0-1 P1:1-2");
    expect(order(sched({ algorithm: "FCFS", processes: procs, rules: { tieBreak: "id" } }))).toBe("P1:0-1 P2:1-2");
  });

  it("CPU가 쉬는 구간", () => {
    const t = sched({ algorithm: "FCFS", processes: [P("P1", 2, 1), P("P2", 5, 1)] });
    expect(order(t)).toBe("-:0-2 P1:2-3 -:3-5 P2:5-6");
    expect(t.steps.at(-1)!.events).toEqual([{ type: "complete", id: "P2" }]);
  });

  it("스키마: RR 퀀텀 누락·중복 이름은 거부", () => {
    expect(ProblemSpecSchema.safeParse({ kind: "scheduling", algorithm: "RR", processes: s3 }).success).toBe(false);
    expect(
      ProblemSpecSchema.safeParse({ kind: "scheduling", algorithm: "FCFS", processes: [P("A", 0, 1), P("A", 0, 1)] })
        .success,
    ).toBe(false);
  });
});

describe("페이지 교체 (참조열 20개, 프레임 3개)", () => {
  const references = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];

  it.each([
    ["FIFO", 15],
    ["OPT", 9],
    ["LRU", 12],
  ])("%s: 부재 %i회", (algorithm, faults) => {
    expect(paging({ algorithm, frames: 3, references }).faults).toBe(faults);
  });

  it("LRU 교체 근거: 가장 오래 전 사용된 페이지", () => {
    const s = paging({ algorithm: "LRU", frames: 3, references }).steps[3]; // 페이지 2 참조
    expect(s).toMatchObject({ hit: false, victim: 7, frames: [2, 0, 1] });
    expect(s.reason!.candidates).toEqual([
      { id: "7", value: 0 },
      { id: "0", value: 1 },
      { id: "1", value: 2 },
    ]);
  });

  it("OPT: 다시 안 쓰이는 페이지는 value null", () => {
    const s = paging({ algorithm: "OPT", frames: 2, references: [1, 2, 3] }).steps[2];
    expect(s.victim).toBe(1); // 둘 다 다시 안 쓰이면 먼저 적재된 1
    expect(s.reason!.candidates.every((c) => c.value === null)).toBe(true);
  });
});

describe("내 풀이 진단", () => {
  it("스케줄링: 처음 어긋난 구간과 해당 Step", () => {
    const t = sched({ algorithm: "SRTF", processes: [P("P1", 0, 8), P("P2", 1, 4), P("P3", 2, 9), P("P4", 3, 5)] });
    // 학생이 선점을 빠뜨린 풀이
    const m = diagnoseScheduling(t, [{ id: "P1", start: 0, end: 8 }]);
    expect(m).toMatchObject({ index: 0, expected: { id: "P1", start: 0, end: 1 } });
    expect(t.steps[m!.stepIndex].time).toBe(0);
    // 순서만 입력해도 비교된다
    expect(diagnoseScheduling(t, ["P1", "P2", "P4", "P1", "P3"].map((id) => ({ id })))).toBeNull();
    expect(diagnoseScheduling(t, ["P1", "P2", "P1"].map((id) => ({ id })))).toMatchObject({ index: 2 });
  });

  it("페이지 교체: 프레임 상태는 칸 순서와 무관하게 비교", () => {
    const t = paging({ algorithm: "FIFO", frames: 3, references: [1, 2, 3, 4] });
    const ok = [[1], [1, 2], [3, 2, 1], [4, 2, 3]].map((frames) => ({ frames }));
    expect(diagnosePaging(t, ok)).toBeNull();
    const wrong = [[1], [1, 2], [1, 2, 3], [1, 2, 4]].map((frames) => ({ frames }));
    expect(diagnosePaging(t, wrong)).toMatchObject({ index: 3, expectedFrames: [4, 2, 3] });
  });
});
