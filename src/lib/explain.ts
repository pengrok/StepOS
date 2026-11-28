import type { PagingSpec, PagingTrace, SchedEvent, SchedulingSpec, SchedulingTrace } from "@/engine";
import { eulReul, iGa, josa } from "./describe";

// 단계별 해설. 엔진 기록(단계, 비교값, 준비 큐)만으로 문장을 만든다. 숫자는 모두 엔진 값이다.

export type Explanation = {
  rule: string; // 이 알고리즘의 규칙 (모든 단계에 공통)
  sections: { title: string; lines: string[] }[];
};

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const eunNeun = (w: string) => josa(w, "은", "는");

// ---------- CPU 스케줄링 ----------

export function schedulingRule(spec: SchedulingSpec): string {
  const tie = `값이 같으면 준비 큐에 먼저 들어온 프로세스를 고릅니다${
    spec.rules.tieBreak === "id" ? " (같은 시각에 도착하면 이름 순)" : " (같은 시각에 도착하면 입력한 순서)"
  }.`;
  switch (spec.algorithm) {
    case "FCFS":
      return `준비 큐에 먼저 들어온 프로세스부터 실행하고, 한번 시작하면 끝날 때까지 실행합니다(비선점). 실행 시간이 짧은지는 보지 않습니다.`;
    case "SJF":
      return `준비 큐에서 실행 시간이 가장 짧은 프로세스를 골라 끝날 때까지 실행합니다(비선점). 실행 중에 더 짧은 프로세스가 도착해도 바꾸지 않습니다. ${tie}`;
    case "SRTF":
      return `남은 실행 시간이 가장 짧은 프로세스를 실행합니다(선점). 실행 중에 남은 시간이 더 짧은 프로세스가 도착하면 바로 바꿉니다. ${tie}`;
    case "HRN":
      return `응답 비율 = (대기 시간 + 실행 시간) ÷ 실행 시간이 가장 큰 프로세스를 골라 끝날 때까지 실행합니다(비선점). 오래 기다릴수록 비율이 커지므로 긴 작업도 언젠가 선택됩니다. ${tie}`;
    case "RR":
      return `준비 큐 맨 앞의 프로세스를 최대 타임 퀀텀(${spec.quantum})만큼 실행합니다. 그 안에 끝나지 않으면 준비 큐 맨 뒤로 보내고 다음 프로세스를 실행합니다. 같은 시각에 새 프로세스 도착과 퀀텀 종료가 겹치면 ${
        spec.rules.rrArrivalFirst ? "새로 도착한 프로세스가 먼저" : "퀀텀이 끝난 프로세스가 먼저"
      } 줄을 섭니다.`;
    case "PRIORITY":
      return `우선순위가 가장 높은 프로세스를 실행합니다. 우선순위는 숫자가 ${
        spec.rules.lowerIsHigher ? "작을수록" : "클수록"
      } 높습니다. ${
        spec.rules.preemptive
          ? "선점형이라 더 높은 프로세스가 도착하면 바로 바꿉니다."
          : "비선점형이라 한번 시작하면 끝날 때까지 실행합니다."
      } ${tie}`;
  }
}

// 준비 큐에 들어온 시각과 이유를 단계 기록에서 찾는다
function queueJoins(trace: SchedulingTrace, upto: number) {
  const joins: Record<string, string> = {};
  for (let k = 0; k <= upto; k++) {
    const s = trace.steps[k];
    for (const e of s.events) {
      if (e.type === "arrive") joins[e.id] = `시각 ${s.time}에 도착`;
      if (e.type === "preempt")
        joins[e.id] = e.cause === "quantum" ? `시각 ${s.time}에 퀀텀이 끝나 다시 섬` : `시각 ${s.time}에 선점당해 돌아옴`;
    }
  }
  return joins;
}

function metricText(spec: SchedulingSpec, trace: SchedulingTrace, id: string, value: number, time: number): string {
  const p = trace.processes.find((x) => x.id === id)!;
  switch (spec.algorithm) {
    case "SJF":
      return `실행 시간 ${value}`;
    case "SRTF":
      return `남은 시간 ${value}`;
    case "HRN":
      return `(대기 ${time - p.arrival} + 실행 ${p.burst}) ÷ ${p.burst} = ${num(value)}`;
    case "PRIORITY":
      return `우선순위 ${value}`;
    default:
      return "";
  }
}

const better = (spec: SchedulingSpec) =>
  spec.algorithm === "HRN"
    ? "가장 큰"
    : spec.algorithm === "PRIORITY"
      ? spec.rules.lowerIsHigher
        ? "숫자가 가장 작은(우선순위가 가장 높은)"
        : "숫자가 가장 큰(우선순위가 가장 높은)"
      : "가장 작은";

export function explainSchedStep(spec: SchedulingSpec, trace: SchedulingTrace, i: number): Explanation {
  const s = trace.steps[i];
  const t = s.time;
  const prev = i > 0 ? trace.steps[i - 1] : null;
  const joinsBefore = queueJoins(trace, i);
  const proc = (id: string) => trace.processes.find((p) => p.id === id)!;
  const ev = <T extends SchedEvent["type"]>(type: T) =>
    s.events.filter((e): e is Extract<SchedEvent, { type: T }> => e.type === type);
  const what: string[] = [];
  const why: string[] = [];

  for (const e of ev("complete")) {
    const p = proc(e.id);
    what.push(
      `${iGa(e.id)} ${eulReul(`실행 시간 ${p.burst}`)} 모두 마치고 끝납니다. 완료 시각 ${p.completion}, 반환 시간 = ${p.completion} − ${p.arrival}(도착) = ${p.turnaround}, 대기 시간 = ${p.turnaround} − ${p.burst}(실행) = ${p.waiting}.`,
    );
  }

  const arrived = ev("arrive").map((e) => e.id);
  const quantumOut = ev("preempt").filter((e) => e.cause === "quantum");
  for (const e of quantumOut) {
    const left = s.remaining[e.id];
    what.push(`${iGa(e.id)} ${eulReul(`퀀텀 ${spec.quantum}`)} 다 썼지만 아직 ${iGa(String(left))} 남아서 준비 큐 맨 뒤로 갑니다.`);
  }
  if (arrived.length) {
    what.push(`${iGa(arrived.join(", "))} 도착해서 준비 큐에 들어옵니다.`);
  }
  if (quantumOut.length && arrived.length) {
    const q = quantumOut[0].id;
    what.push(
      spec.rules.rrArrivalFirst
        ? `같은 시각에 도착과 퀀텀 종료가 겹쳤습니다. 규칙 옵션에 따라 새로 도착한 ${iGa(arrived.join(", "))} 먼저 줄을 서고, ${eunNeun(q)} 그 뒤에 섭니다.`
        : `같은 시각에 도착과 퀀텀 종료가 겹쳤습니다. 규칙 옵션에 따라 ${iGa(q)} 먼저 줄을 서고, 새로 도착한 ${eunNeun(arrived.join(", "))} 그 뒤에 섭니다.`,
    );
  }

  for (const e of ev("preempt").filter((e) => e.cause === "better")) {
    const r = e.reason!;
    const v = (id: string) => metricText(spec, trace, id, r.candidates.find((c) => c.id === id)!.value!, t);
    what.push(`${iGa(e.by!)} 실행 중이던 ${eulReul(e.id)} 밀어냅니다(선점). ${eunNeun(e.id)} 준비 큐로 돌아갑니다.`);
    why.push(`${e.by!}: ${v(e.by!)}, ${e.id}: ${v(e.id)}. ${spec.algorithm === "SRTF" ? `${e.by!}의 남은 시간이 더 짧아서` : `${e.by!}의 우선순위가 더 높아서`} 바로 바꿉니다.`);
  }

  if (ev("idle").length) {
    const seg = trace.gantt.find((g) => g.id === null && g.start === t)!;
    what.push(`준비 큐가 비어 있어서 CPU가 쉽니다. 다음 프로세스는 시각 ${seg.end}에 도착합니다.`);
  }

  const dispatch = ev("dispatch")[0];
  if (dispatch) {
    const r = dispatch.reason;
    what.push(`${eulReul(dispatch.id)} 실행합니다.`);
    if (spec.algorithm === "FCFS" || spec.algorithm === "RR") {
      why.push(
        `${eunNeun(spec.algorithm)} 실행 시간과 관계없이 준비 큐에 줄 선 순서대로 실행합니다. 지금 줄의 맨 앞이 ${dispatch.id}입니다.`,
      );
      why.push("줄 선 순서 (앞 → 뒤):", ...r.candidates.map((c, k) => `${k + 1}. ${c.id}: ${joinsBefore[c.id] ?? "대기 중"}`));
      if (r.candidates.length === 1 && quantumOut.some((e) => e.id === dispatch.id))
        why.push(`줄에 다른 프로세스가 없어서 ${iGa(dispatch.id)} 바로 다시 실행됩니다.`);
    } else {
      why.push("준비 큐의 후보를 비교합니다.", ...r.candidates.map((c) => `${c.id}: ${metricText(spec, trace, c.id, c.value!, t)}`));
      const best = r.candidates.find((c) => c.id === r.chosen)!.value;
      const tied = r.candidates.filter((c) => c.value === best);
      why.push(
        tied.length > 1
          ? `${tied.map((c) => c.id).join(", ")}의 값이 같아서, 준비 큐에 먼저 들어온 ${eulReul(r.chosen)} 고릅니다.`
          : `${better(spec)} 값인 ${eulReul(r.chosen)} 고릅니다.`,
      );
    }
  } else if (s.running) {
    // 실행 중인 프로세스가 그대로 계속됨
    const run = s.running;
    if (spec.algorithm === "SRTF" || (spec.algorithm === "PRIORITY" && spec.rules.preemptive)) {
      const val = (id: string) =>
        spec.algorithm === "SRTF" ? `남은 시간 ${s.remaining[id]}` : `우선순위 ${spec.processes.find((p) => p.id === id)!.priority}`;
      why.push(
        `새로 들어온 프로세스(${arrived.map((id) => `${id}: ${val(id)}`).join(", ")})가 실행 중인 ${run}(${val(run)})보다 낫지 않아서 선점하지 않습니다. 값이 같아도 바꾸지 않습니다.`,
      );
    } else if (spec.algorithm === "RR") {
      const start = [...trace.steps.slice(0, i + 1)]
        .reverse()
        .find((x) => x.events.some((e) => e.type === "dispatch" && e.id === run))!.time;
      why.push(`${eunNeun(run)} 시각 ${start}부터 실행 중이고, 퀀텀 ${spec.quantum} 중 ${t - start}만큼 썼습니다. 퀀텀을 다 쓰거나 끝날 때까지 계속 실행합니다.`);
    } else {
      why.push(`${eunNeun(run)} 실행 중입니다. 비선점 방식이라 새 프로세스가 와도 ${iGa(run)} 끝날 때까지 바뀌지 않습니다.`);
    }
  }

  const sections = [{ title: "무슨 일이 있었나", lines: what }];
  if (why.length) sections.push({ title: s.running ? `왜 ${s.running}인가` : "왜 이렇게 되나", lines: why });

  sections.push({
    title: "지금 준비 큐",
    lines: s.readyQueue.length
      ? s.readyQueue.map((id, k) => `${k + 1}. ${id}: ${joinsBefore[id] ?? "대기 중"}, 남은 시간 ${s.remaining[id]}`)
      : ["비어 있습니다."],
  });

  const next = trace.steps[i + 1];
  if (next) {
    sections.push({
      title: "다음 단계",
      lines: [
        s.running
          ? `${eunNeun(s.running)} 다음 단계인 시각 ${next.time}까지 ${next.time - t}만큼 실행됩니다.`
          : `다음 단계는 시각 ${next.time}입니다.`,
      ],
    });
  } else {
    sections.push({
      title: "끝",
      lines: [`모든 프로세스가 끝났습니다. 평균 대기 시간 ${num(trace.avgWaiting)}, 평균 반환 시간 ${num(trace.avgTurnaround)}.`],
    });
  }
  if (prev === null && !dispatch && !s.running) sections[0].lines.push("아직 도착한 프로세스가 없습니다.");
  return { rule: schedulingRule(spec), sections };
}

// ---------- 페이지 교체 ----------

export function pagingRule(spec: PagingSpec): string {
  const base = `프레임 ${spec.frames}개에 페이지를 담습니다. 참조한 페이지가 프레임에 있으면 적중, 없으면 부재입니다. 부재일 때 빈 프레임이 있으면 그대로 넣고, 가득 차 있으면 하나를 내보냅니다.`;
  switch (spec.algorithm) {
    case "FIFO":
      return `${base} FIFO는 가장 먼저 들어온 페이지를 내보냅니다. 적중해도 들어온 순서는 바뀌지 않습니다.`;
    case "LRU":
      return `${base} LRU는 가장 오랫동안 쓰이지 않은 페이지를 내보냅니다. 적중하면 그 페이지의 마지막 사용 시점이 지금으로 바뀝니다.`;
    case "OPT":
      return `${base} OPT는 앞으로 가장 늦게 쓰일 페이지를 내보냅니다. 다시 안 쓰이는 페이지가 있으면 그것을 먼저 내보내고, 여러 개면 먼저 들어온 페이지를 내보냅니다. 미래 참조를 알아야 해서 실제로는 쓸 수 없고, 다른 알고리즘의 비교 기준으로 씁니다.`;
  }
}

export function explainPagingStep(spec: PagingSpec, trace: PagingTrace, i: number): Explanation {
  const s = trace.steps[i];
  const nth = (k: number) => `${k + 1}번째 참조`;
  const page = `페이지 ${s.page}`;
  const what: string[] = [];
  const why: string[] = [];

  if (s.hit) {
    what.push(`${iGa(page)} 이미 프레임 ${s.slot! + 1}에 있어서 적중입니다. 프레임은 바뀌지 않습니다.`);
    if (spec.algorithm === "LRU") why.push(`LRU는 ${page}의 마지막 사용 시점을 지금(${nth(i)})으로 바꿉니다. 그래서 다음 교체 때 가장 늦게 밀려납니다.`);
    if (spec.algorithm === "FIFO") why.push(`FIFO는 적중해도 들어온 순서를 바꾸지 않습니다.`);
  } else if (s.victim === null) {
    what.push(`${iGa(page)} 프레임에 없어서 부재입니다. 빈 프레임 ${s.slot! + 1}에 넣습니다.`);
  } else {
    const r = s.reason!;
    const label = (v: number | null) => {
      if (spec.algorithm === "FIFO") return `${nth(v!)} 때 들어옴`;
      if (spec.algorithm === "LRU") return `마지막 사용 ${nth(v!)}`;
      return v === null ? "다시 안 쓰임" : `다음 사용 ${nth(v)}`;
    };
    what.push(`${iGa(page)} 프레임에 없어서 부재입니다. 프레임이 가득 차서 하나를 내보내야 합니다.`);
    why.push("프레임에 있는 페이지를 비교합니다.", ...r.candidates.map((c) => `페이지 ${c.id}: ${label(c.value)}`));
    const pick =
      spec.algorithm === "FIFO"
        ? "가장 먼저 들어온"
        : spec.algorithm === "LRU"
          ? "가장 오래전에 쓰인"
          : r.candidates.find((c) => c.id === r.chosen)!.value === null
            ? "다시 안 쓰이는"
            : "가장 늦게 쓰일";
    const ties = spec.algorithm === "OPT" && r.candidates.filter((c) => c.value === null).length > 1;
    why.push(
      `${pick} 페이지 ${eulReul(String(s.victim))} 내보내고, 그 자리(프레임 ${s.slot! + 1})에 ${eulReul(String(s.page))} 넣습니다.${
        ties ? " 다시 안 쓰이는 페이지가 여럿이라 그중 먼저 들어온 페이지를 골랐습니다." : ""
      }`,
    );
  }

  const upto = trace.steps.slice(0, i + 1);
  const faults = upto.filter((x) => !x.hit).length;
  const sections = [{ title: "무슨 일이 있었나", lines: what }];
  if (why.length) sections.push({ title: s.victim !== null ? `왜 페이지 ${eulReul(String(s.victim))} 내보내나` : "알아 둘 점", lines: why });
  sections.push({
    title: "지금까지",
    lines: [
      `프레임: ${s.frames.map((f, k) => `${k + 1}번 ${f ?? "빈칸"}`).join(", ")}`,
      `부재 ${faults}회, 적중 ${upto.length - faults}회${i === trace.steps.length - 1 ? ` (전체 ${trace.steps.length}번 참조, 부재율 ${Math.round((trace.faults / trace.steps.length) * 100)}%)` : ""}`,
    ],
  });
  return { rule: pagingRule(spec), sections };
}

