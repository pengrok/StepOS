import { describe, expect, it } from "vitest";
import { simulate, type PagingTrace, type SchedulingTrace } from "../engine";
import { PagingSpecSchema, SchedulingSpecSchema } from "./schema";
import { explainPagingStep, explainSchedStep } from "./explain";

const text = (e: { rule: string; sections: { title: string; lines: string[] }[] }) =>
  [e.rule, ...e.sections.flatMap((s) => [`[${s.title}]`, ...s.lines])].join("\n");
const P = (id: string, arrival: number, burst: number, priority?: number) => ({ id, arrival, burst, priority });

function sched(input: object, time: number) {
  const spec = SchedulingSpecSchema.parse({ kind: "scheduling", ...input });
  const trace = simulate(spec) as SchedulingTrace;
  const i = trace.steps.findIndex((s) => s.time === time);
  return text(explainSchedStep(spec, trace, i));
}

describe("스케줄링 해설", () => {
  const rr = { algorithm: "RR", quantum: 2, processes: [P("P1", 0, 5), P("P2", 1, 3), P("P3", 2, 1), P("P4", 3, 2), P("P5", 4, 3)] };

  it("RR 시각 5: P1이 P4, P5보다 먼저 줄을 섰다는 근거를 보여 준다", () => {
    const t = sched(rr, 5);
    expect(t).toContain("P3이 실행 시간 1을 모두 마치고 끝납니다");
    expect(t).toContain("지금 줄의 맨 앞이 P1입니다");
    expect(t).toContain("1. P1: 시각 2에 퀀텀이 끝나 다시 섬\n2. P4: 시각 3에 도착\n3. P5: 시각 4에 도착");
    expect(t).toContain("다음 단계인 시각 7까지 2만큼");
  });

  it("RR 시각 2: 도착과 퀀텀 종료가 겹친 경우 규칙 옵션을 설명한다", () => {
    expect(sched(rr, 2)).toContain("새로 도착한 P3이 먼저 줄을 서고, P1은 그 뒤에 섭니다");
    expect(sched({ ...rr, rules: { rrArrivalFirst: false } }, 2)).toContain("P1이 먼저 줄을 서고, 새로 도착한 P3은 그 뒤에");
  });

  it("HRN: 응답 비율 계산식을 보여 준다", () => {
    const t = sched({ algorithm: "HRN", processes: [P("A", 0, 10), P("B", 1, 4), P("C", 8, 1), P("D", 9, 2)] }, 10);
    expect(t).toContain("B: (대기 9 + 실행 4) ÷ 4 = 3.25");
    expect(t).toContain("가장 큰 값인 B를 고릅니다");
  });

  it("SRTF: 선점 이유와 선점하지 않는 이유", () => {
    const procs = [P("P1", 0, 8), P("P2", 1, 4), P("P3", 2, 9), P("P4", 3, 5)];
    expect(sched({ algorithm: "SRTF", processes: procs }, 1)).toContain("P2: 남은 시간 4, P1: 남은 시간 7");
    expect(sched({ algorithm: "SRTF", processes: procs }, 2)).toContain("P3: 남은 시간 9");
    expect(sched({ algorithm: "SRTF", processes: procs }, 2)).toContain("선점하지 않습니다");
  });

  it("동점이면 먼저 들어온 쪽을 고른다고 설명한다", () => {
    const t = sched({ algorithm: "SJF", processes: [P("A", 0, 2), P("B", 0, 2)] }, 0);
    expect(t).toContain("A, B의 값이 같아서, 준비 큐에 먼저 들어온 A를 고릅니다");
  });

  it("CPU 쉼", () => {
    expect(sched({ algorithm: "FCFS", processes: [P("P1", 3, 1)] }, 0)).toContain("다음 프로세스는 시각 3에 도착합니다");
  });
});

describe("페이지 교체 해설", () => {
  const references = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
  const paging = (algorithm: string, i: number) => {
    const spec = PagingSpecSchema.parse({ kind: "paging", algorithm, frames: 3, references });
    return text(explainPagingStep(spec, simulate(spec) as PagingTrace, i));
  };

  it("LRU 교체: 마지막 사용 시점을 비교한다", () => {
    const t = paging("LRU", 3);
    expect(t).toContain("페이지 7: 마지막 사용 1번째 참조\n페이지 0: 마지막 사용 2번째 참조\n페이지 1: 마지막 사용 3번째 참조");
    expect(t).toContain("가장 오래전에 쓰인 페이지 7을 내보내고, 그 자리(프레임 1)에 2를 넣습니다");
  });

  it("OPT: 다시 안 쓰이는 페이지", () => {
    expect(paging("OPT", 3)).toContain("페이지 7: 다음 사용 18번째 참조");
  });

  it("LRU 적중: 마지막 사용 시점 갱신", () => {
    expect(paging("LRU", 4)).toContain("페이지 0의 마지막 사용 시점을 지금(5번째 참조)으로 바꿉니다");
  });
});
