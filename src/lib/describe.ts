import type { PagingStep, Reason, SchedEvent, SchedStep } from "@/engine";

// 엔진 기록을 그대로 문장으로 옮긴 기본 설명. LLM 설명이 없거나 실패해도 이 문장은 항상 맞다.

// 받침 유무로 조사를 고른다. 숫자는 한국어로 읽는 소리 기준 (0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 → 받침 있음)
function hasBatchim(word: string): boolean {
  const c = word.at(-1) ?? "";
  if (/[0-9]/.test(c)) return "013678".includes(c);
  const code = c.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) return code % 28 !== 0;
  return /[lmnr]/i.test(c); // 영문은 대략 L, M, N, R로 끝나면 받침 소리
}
const josa = (word: string, withBatchim: string, without: string) =>
  `${word}${hasBatchim(word) ? withBatchim : without}`;
const iGa = (w: string) => josa(w, "이", "가");
const eulReul = (w: string) => josa(w, "을", "를");

const fmt = (v: number | null) => (v === null ? "다시 안 쓰임" : Number.isInteger(v) ? String(v) : v.toFixed(2));
const METRIC: Record<string, string> = {
  burst: "실행 시간",
  remaining: "남은 시간",
  responseRatio: "응답 비율",
  priority: "우선순위",
  queueOrder: "큐 위치",
  loadedAt: "적재 시점",
  lastUsed: "마지막 사용",
  nextUse: "다음 사용",
};
const compare = (r: Reason) =>
  r.metric === "queueOrder" ? "" : ` (${METRIC[r.metric]}: ${r.candidates.map((c) => `${c.id}=${fmt(c.value)}`).join(", ")})`;

function eventLine(e: SchedEvent, quantum?: number): string {
  switch (e.type) {
    case "arrive":
      return `${e.id} 도착 → 준비 큐에 들어감`;
    case "complete":
      return `${e.id} 실행 완료`;
    case "idle":
      return "준비 큐가 비어 CPU가 쉼";
    case "dispatch":
      return `${eulReul(e.id)} 선택: ${e.reason.rule}${compare(e.reason)}`;
    case "preempt":
      return e.cause === "quantum"
        ? `${e.id}의 타임 퀀텀(${quantum})이 끝나 준비 큐 뒤로 돌아감`
        : `${iGa(e.by!)} ${eulReul(e.id)} 선점: ${e.reason!.rule}${compare(e.reason!)}`;
  }
}

export const describeSchedStep = (s: SchedStep, quantum?: number) => s.events.map((e) => eventLine(e, quantum));

export function describePagingStep(s: PagingStep): string[] {
  const page = `페이지 ${s.page}`;
  if (s.hit) return [`${iGa(page)} 이미 프레임 ${s.slot! + 1}에 있음 → 적중`];
  if (s.victim === null) return [`${page} 부재 → 빈 프레임 ${s.slot! + 1}에 적재`];
  return [`${page} 부재, 빈 프레임 없음`, `페이지 ${eulReul(String(s.victim))} 교체: ${s.reason!.rule}${compare(s.reason!)}`];
}
