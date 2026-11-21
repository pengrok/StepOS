"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { simulate, type PagingTrace, type ProblemSpec, type SchedulingTrace } from "@/engine";
import { describePagingStep, describeSchedStep } from "@/lib/describe";
import { PROCESS_COLORS } from "@/lib/samples";

const ALG_NAME: Record<string, string> = {
  FCFS: "FCFS",
  SJF: "SJF (비선점)",
  SRTF: "SRTF (선점 SJF)",
  HRN: "HRN",
  RR: "라운드 로빈",
  PRIORITY: "우선순위",
  FIFO: "FIFO",
  LRU: "LRU",
  OPT: "OPT (최적)",
};

export default function Simulator({ spec }: { spec: ProblemSpec }) {
  const trace = useMemo(() => simulate(spec), [spec]);
  const total = trace.steps.length;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || i >= total - 1) return;
    const id = setTimeout(() => {
      setI(i + 1);
      if (i + 1 >= total - 1) setPlaying(false);
    }, 1100);
    return () => clearTimeout(id);
  }, [playing, i, total]);

  const go = (n: number) => {
    setPlaying(false);
    setI(Math.max(0, Math.min(total - 1, n)));
  };

  const lines =
    trace.kind === "scheduling"
      ? describeSchedStep(trace.steps[i], spec.kind === "scheduling" ? spec.quantum : undefined)
      : describePagingStep(trace.steps[i]);
  const stepLabel =
    trace.kind === "scheduling" ? `시각 ${trace.steps[i].time}` : `참조 ${i + 1}번째 (페이지 ${trace.steps[i].page})`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          스텝OS
        </Link>
        <p className="text-pencil">
          {ALG_NAME[spec.algorithm]}
          {spec.kind === "scheduling" && spec.algorithm === "RR" && `, 타임 퀀텀 ${spec.quantum}`}
          {spec.kind === "paging" && `, 프레임 ${spec.frames}개`}
        </p>
      </header>

      <section aria-label="시뮬레이션" className="mt-6 border-2 border-ink bg-surface/80 p-4 sm:p-6">
        {trace.kind === "scheduling" ? <Gantt trace={trace} step={i} /> : <FrameTable trace={trace} step={i} />}
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="단계 이동">
        <Btn onClick={() => go(0)} disabled={i === 0}>처음</Btn>
        <Btn onClick={() => go(i - 1)} disabled={i === 0}>이전 단계</Btn>
        <Btn primary onClick={() => (i >= total - 1 ? go(0) : setPlaying((p) => !p))}>
          {playing ? "멈춤" : i >= total - 1 ? "다시 재생" : "재생"}
        </Btn>
        <Btn onClick={() => go(i + 1)} disabled={i >= total - 1}>다음 단계</Btn>
        <Btn onClick={() => go(total - 1)} disabled={i >= total - 1}>끝</Btn>
        <span className="ml-auto text-sm text-pencil">
          {i + 1} / {total} 단계
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-label="현재 상태">
          {trace.kind === "scheduling" ? <SchedState trace={trace} step={i} /> : <PagingSummary trace={trace} step={i} />}
        </section>

        <aside aria-live="polite" className="relative border-l-4 border-marker bg-surface p-4 shadow-[4px_4px_0_var(--grid)]">
          <h2 className="font-bold">{stepLabel}에 일어난 일</h2>
          <ul className="mt-3 space-y-2 leading-relaxed">
            {lines.map((l, k) => (
              <li key={k}>{l}</li>
            ))}
          </ul>
          <form className="mt-5 flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="ask" className="sr-only">
              이 단계에 대해 질문하기
            </label>
            <input
              id="ask"
              placeholder="이 단계에서 궁금한 점 (AI 연결 예정)"
              className="min-w-0 flex-1 border border-pencil/40 bg-paper px-3 py-2 text-sm"
              disabled
            />
          </form>
          {spec.assumptions.length > 0 && (
            <p className="mt-4 text-sm text-pencil">적용한 가정: {spec.assumptions.join(", ")}</p>
          )}
        </aside>
      </div>

      {i === total - 1 && (trace.kind === "scheduling" ? <SchedResult trace={trace} /> : null)}
    </main>
  );
}

function Btn({ primary, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...p}
      className={`border-2 border-ink px-4 py-2 font-medium disabled:opacity-35 ${
        primary ? "min-w-24 bg-ink text-paper" : "bg-surface hover:bg-marker/60"
      }`}
    />
  );
}

// ---------- 스케줄링 ----------

function useColors(trace: SchedulingTrace) {
  return Object.fromEntries(trace.processes.map((p, k) => [p.id, PROCESS_COLORS[k % PROCESS_COLORS.length]]));
}

function Gantt({ trace, step }: { trace: SchedulingTrace; step: number }) {
  const color = useColors(trace);
  const end = trace.gantt.at(-1)!.end;
  const now = trace.steps[step].time;
  const pct = (x: number) => `${(x / end) * 100}%`;
  const ticks = [...new Set(trace.gantt.flatMap((g) => [g.start, g.end]))];

  return (
    <figure>
      <figcaption className="mb-3 font-bold">간트 차트</figcaption>
      <div className="relative h-16">
        {/* 형광펜: 현재 시각 */}
        <div
          className="absolute -top-2 -bottom-2 w-3 -translate-x-1/2 bg-marker/80 transition-[left] duration-500"
          style={{ left: pct(now) }}
          aria-hidden
        />
        {trace.gantt.map((g, k) => {
          if (g.start >= now && !(step === trace.steps.length - 1)) return null;
          const shownEnd = step === trace.steps.length - 1 ? g.end : Math.min(g.end, now);
          return (
            <div
              key={k}
              className="absolute inset-y-0 flex items-center justify-center overflow-hidden border-2 border-ink font-bold text-white"
              style={{
                left: pct(g.start),
                width: pct(shownEnd - g.start),
                background: g.id ? color[g.id] : "repeating-linear-gradient(45deg,#fff,#fff 4px,var(--grid) 4px,var(--grid) 8px)",
              }}
              title={`${g.id ?? "쉼"} ${g.start}–${g.end}`}
            >
              {g.id}
            </div>
          );
        })}
      </div>
      <div className="relative mt-1 h-6 text-sm text-pencil">
        {ticks.map((x) => (
          <span key={x} className="absolute -translate-x-1/2" style={{ left: pct(x) }}>
            {x}
          </span>
        ))}
      </div>
    </figure>
  );
}

function SchedState({ trace, step }: { trace: SchedulingTrace; step: number }) {
  const color = useColors(trace);
  const s = trace.steps[step];
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h2 className="font-bold">준비 큐</h2>
        <p className="mt-1 text-sm text-pencil">왼쪽이 큐의 앞</p>
        <ol className="mt-3 flex min-h-11 flex-wrap gap-2">
          {s.readyQueue.length === 0 && <li className="text-pencil">비어 있음</li>}
          {s.readyQueue.map((id) => (
            <li key={id} className="border-2 border-ink bg-surface px-3 py-1.5 font-bold" style={{ color: color[id] }}>
              {id}
            </li>
          ))}
        </ol>
        <p className="mt-4">
          실행 중: <b>{s.running ?? "없음"}</b>
        </p>
      </div>
      <div>
        <h2 className="font-bold">남은 실행 시간</h2>
        <ul className="mt-3 space-y-2">
          {trace.processes.map((p) => {
            const r = s.remaining[p.id];
            return (
              <li key={p.id} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-2">
                <span className="font-bold">{p.id}</span>
                <span className="h-3 border border-ink bg-surface">
                  <span
                    className="block h-full transition-[width] duration-500"
                    style={{ width: `${(r / p.burst) * 100}%`, background: color[p.id] }}
                  />
                </span>
                <span className="text-right">{r}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SchedResult({ trace }: { trace: SchedulingTrace }) {
  const f = (x: number) => (Number.isInteger(x) ? x : x.toFixed(2));
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">결과</h2>
      <p className="mt-2">
        평균 대기 시간 <b>{f(trace.avgWaiting)}</b>, 평균 반환 시간 <b>{f(trace.avgTurnaround)}</b>, 평균 응답 시간{" "}
        <b>{f(trace.avgResponse)}</b>
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-2 border-ink bg-surface text-left">
          <thead className="border-b-2 border-ink">
            <tr>
              {["프로세스", "도착", "실행", "완료", "반환", "대기", "응답"].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trace.processes.map((p) => (
              <tr key={p.id} className="border-t border-grid">
                <td className="px-3 py-2 font-bold">{p.id}</td>
                {[p.arrival, p.burst, p.completion, p.turnaround, p.waiting, p.response].map((v, k) => (
                  <td key={k} className="px-3 py-2">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- 페이지 교체 ----------

function FrameTable({ trace, step }: { trace: PagingTrace; step: number }) {
  const rows = trace.steps[0].frames.length;
  return (
    <figure className="overflow-x-auto">
      <figcaption className="mb-3 font-bold">프레임 표</figcaption>
      <table className="w-max border-collapse text-center">
        <thead>
          <tr>
            <th className="whitespace-nowrap px-2 py-1 text-left text-sm font-medium text-pencil">참조</th>
            {trace.steps.map((s) => (
              <th key={s.index} className={`w-9 px-1 py-1 ${s.index === step ? "bg-marker" : ""}`}>
                {s.page}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <th className="whitespace-nowrap px-2 py-1 text-left text-sm font-medium text-pencil">프레임 {r + 1}</th>
              {trace.steps.map((s) => {
                const shown = s.index <= step;
                const changed = shown && !s.hit && s.slot === r;
                return (
                  <td
                    key={s.index}
                    className={`h-9 min-w-9 border border-ink ${s.index === step ? "bg-marker/50" : "bg-surface"} ${
                      changed ? "font-bold text-fault" : ""
                    }`}
                  >
                    {shown ? (s.frames[r] ?? "") : ""}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th className="whitespace-nowrap px-2 py-1 text-left text-sm font-medium text-pencil">결과</th>
            {trace.steps.map((s) => (
              <td key={s.index} className={`whitespace-nowrap px-0.5 py-1 text-sm font-bold ${s.hit ? "text-hit" : "text-fault"}`}>
                {s.index <= step ? (s.hit ? "적중" : "부재") : ""}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </figure>
  );
}

function PagingSummary({ trace, step }: { trace: PagingTrace; step: number }) {
  const upto = trace.steps.slice(0, step + 1);
  const faults = upto.filter((s) => !s.hit).length;
  return (
    <div>
      <h2 className="font-bold">지금까지</h2>
      <p className="mt-2 text-lg">
        페이지 부재 <b className="text-fault">{faults}</b>회, 적중 <b className="text-hit">{upto.length - faults}</b>회
      </p>
      {step === trace.steps.length - 1 && (
        <p className="mt-2 text-pencil">
          전체 {trace.steps.length}번 참조 중 부재 {trace.faults}회 (부재율 {Math.round((trace.faults / trace.steps.length) * 100)}%)
        </p>
      )}
    </div>
  );
}
