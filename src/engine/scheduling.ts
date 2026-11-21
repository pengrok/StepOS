import type {
  GanttSegment,
  ProcessResult,
  Reason,
  SchedEvent,
  SchedStep,
  SchedulingSpec,
  SchedulingTrace,
} from "./types";

type Proc = SchedulingSpec["processes"][number] & { order: number };

const RULES: Record<SchedulingSpec["algorithm"], { rule: string; metric: string }> = {
  FCFS: { rule: "준비 큐에 먼저 들어온 프로세스", metric: "queueOrder" },
  SJF: { rule: "실행 시간이 가장 짧은 프로세스", metric: "burst" },
  SRTF: { rule: "남은 실행 시간이 가장 짧은 프로세스", metric: "remaining" },
  HRN: { rule: "응답 비율 (대기 시간 + 실행 시간) / 실행 시간이 가장 큰 프로세스", metric: "responseRatio" },
  RR: { rule: "준비 큐 맨 앞의 프로세스", metric: "queueOrder" },
  PRIORITY: { rule: "우선순위가 가장 높은 프로세스", metric: "priority" },
};

// 1 시간 단위로 진행하고, 이벤트가 있는 시각마다 Step 하나를 남긴다.
// 순서: (이전 단위의 완료·퀀텀 만료) → 도착 → 선점 → 디스패치 → 1 단위 실행
export function simulateScheduling(spec: SchedulingSpec): SchedulingTrace {
  const { algorithm: alg, rules, quantum = 1 } = spec;
  const procs: Proc[] = spec.processes.map((p, order) => ({ ...p, order }));
  const byId = new Map(procs.map((p) => [p.id, p]));
  const tieOrder = (a: Proc, b: Proc) =>
    rules.tieBreak === "id" ? a.id.localeCompare(b.id, undefined, { numeric: true }) : a.order - b.order;
  const arrivalOrder = [...procs].sort((a, b) => a.arrival - b.arrival || tieOrder(a, b));

  const remaining: Record<string, number> = Object.fromEntries(procs.map((p) => [p.id, p.burst]));
  const firstRun: Record<string, number> = {};
  const completion: Record<string, number> = {};
  const ready: string[] = []; // 들어온 순서를 유지한다 (FCFS·RR의 큐, 나머지의 동점 처리)
  const steps: SchedStep[] = [];
  const gantt: GanttSegment[] = [];
  let carry: SchedEvent[] = []; // 직전 단위가 끝나며 생긴 이벤트 (완료, 퀀텀 만료)
  let running: string | null = null;
  let sliceUsed = 0;
  let requeue: string | null = null;
  let next = 0;
  let t = 0;

  const metricValue = (id: string): number => {
    const p = byId.get(id)!;
    switch (alg) {
      case "SJF":
        return p.burst;
      case "SRTF":
        return remaining[id];
      case "HRN":
        return (t - p.arrival + p.burst) / p.burst;
      case "PRIORITY":
        return p.priority!;
      default:
        return ready.indexOf(id);
    }
  };
  // a가 b보다 먼저 선택돼야 하면 음수. 0이면 동점 → 먼저 있던 쪽 유지
  const compare = (a: string, b: string): number => {
    const d = metricValue(a) - metricValue(b);
    if (alg === "HRN") return -d;
    if (alg === "PRIORITY") return rules.lowerIsHigher ? d : -d;
    return d;
  };
  const pick = (cands: string[]) => cands.reduce((best, c) => (compare(c, best) < 0 ? c : best));
  const reasonFor = (cands: string[], chosen: string): Reason => ({
    ...RULES[alg],
    candidates: cands.map((id) => ({ id, value: metricValue(id) })),
    chosen,
  });
  const preemptive = alg === "SRTF" || (alg === "PRIORITY" && rules.preemptive);
  const snapshot = (events: SchedEvent[]) =>
    steps.push({ time: t, events, running, readyQueue: [...ready], remaining: { ...remaining } });

  while (Object.keys(completion).length < procs.length) {
    const events = carry;
    carry = [];

    // 1. 도착
    const arrived: string[] = [];
    while (next < arrivalOrder.length && arrivalOrder[next].arrival === t) {
      const id = arrivalOrder[next++].id;
      arrived.push(id);
      events.push({ type: "arrive", id });
    }
    if (requeue && !rules.rrArrivalFirst) ready.push(requeue);
    ready.push(...arrived);
    if (requeue && rules.rrArrivalFirst) ready.push(requeue);
    requeue = null;

    // 2. 선점 (SRTF, 선점형 우선순위): 더 나은 프로세스가 있을 때만, 동점이면 계속 실행
    if (running && preemptive && ready.length) {
      const cands = [running, ...ready];
      const best = pick(cands);
      if (best !== running) {
        events.push({ type: "preempt", id: running, by: best, cause: "better", reason: reasonFor(cands, best) });
        ready.push(running);
        running = null;
      }
    }

    // 3. 디스패치
    if (!running && ready.length) {
      const cands = [...ready];
      const chosen = alg === "FCFS" || alg === "RR" ? ready[0] : pick(cands);
      events.push({ type: "dispatch", id: chosen, reason: reasonFor(cands, chosen) });
      ready.splice(ready.indexOf(chosen), 1);
      running = chosen;
      sliceUsed = 0;
      firstRun[chosen] ??= t;
      gantt.push({ id: chosen, start: t, end: t });
    }

    // CPU 쉼: 다음 도착 시각까지 건너뛴다
    if (!running) {
      const until = arrivalOrder[next].arrival;
      events.push({ type: "idle" });
      gantt.push({ id: null, start: t, end: until });
      snapshot(events);
      t = until;
      continue;
    }

    if (events.length) snapshot(events);

    // 4. 1 단위 실행
    remaining[running]--;
    sliceUsed++;
    t++;
    gantt[gantt.length - 1].end = t;

    if (remaining[running] === 0) {
      completion[running] = t;
      carry.push({ type: "complete", id: running });
      running = null;
    } else if (alg === "RR" && sliceUsed === quantum) {
      // 혼자 남았더라도 퀀텀이 끝나면 큐로 돌아갔다가 다시 선택된다
      carry.push({ type: "preempt", id: running, by: null, cause: "quantum" });
      requeue = running;
      running = null;
    }
  }
  snapshot(carry); // 마지막 완료

  const results: ProcessResult[] = procs.map((p) => {
    const turnaround = completion[p.id] - p.arrival;
    return {
      id: p.id,
      arrival: p.arrival,
      burst: p.burst,
      start: firstRun[p.id],
      completion: completion[p.id],
      turnaround,
      waiting: turnaround - p.burst,
      response: firstRun[p.id] - p.arrival,
    };
  });
  const avg = (k: "waiting" | "turnaround" | "response") => results.reduce((s, r) => s + r[k], 0) / results.length;

  // RR에서 혼자 남아 연속 실행된 구간처럼 같은 프로세스가 이어지면 한 구간으로 합친다
  const merged = gantt.reduce<GanttSegment[]>((acc, g) => {
    const last = acc.at(-1);
    if (last && last.id === g.id && last.end === g.start) last.end = g.end;
    else acc.push({ ...g });
    return acc;
  }, []);

  return {
    kind: "scheduling",
    steps,
    gantt: merged,
    processes: results,
    avgWaiting: avg("waiting"),
    avgTurnaround: avg("turnaround"),
    avgResponse: avg("response"),
  };
}
