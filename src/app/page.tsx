"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProblemSpecSchema, type PagingSpec, type SchedulingSpec } from "@/lib/schema";
import { SAMPLE_PAGING, SAMPLE_SCHEDULING, encodeSpec } from "@/lib/samples";

type Kind = "scheduling" | "paging";
const SCHED_ALGS = ["FCFS", "SJF", "SRTF", "HRN", "RR", "PRIORITY"] as const;
const PAGE_ALGS = ["FIFO", "LRU", "OPT"] as const;

export default function InputPage() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("scheduling");
  const [sched, setSched] = useState<SchedulingSpec>(SAMPLE_SCHEDULING);
  const [paging, setPaging] = useState<PagingSpec>(SAMPLE_PAGING);
  const [refsText, setRefsText] = useState(SAMPLE_PAGING.references.join(" "));
  const [errors, setErrors] = useState<string[]>([]);
  const [aiNote, setAiNote] = useState("");

  const run = () => {
    const spec = kind === "scheduling" ? sched : { ...paging, references: refsText.split(/[\s,]+/).filter(Boolean).map(Number) };
    const r = ProblemSpecSchema.safeParse(spec);
    if (!r.success) return setErrors(r.error.issues.map((i) => i.message));
    setErrors([]);
    router.push(`/simulate?spec=${encodeSpec(r.data)}`);
  };

  const setProc = (k: number, field: "id" | "arrival" | "burst" | "priority", v: string) =>
    setSched((s) => ({
      ...s,
      processes: s.processes.map((p, j) =>
        j !== k ? p : { ...p, [field]: field === "id" ? v : v === "" ? undefined : Number(v) },
      ),
    }));
  const rule = <K extends keyof SchedulingSpec["rules"]>(k: K, v: SchedulingSpec["rules"][K]) =>
    setSched((s) => ({ ...s, rules: { ...s.rules, [k]: v } }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">스텝OS</h1>
        <p className="mt-2 max-w-xl text-pencil">
          운영체제 문제를 넣으면 간트 차트와 프레임 표를 한 단계씩 그려 보여 줍니다. 각 단계마다 왜 그렇게 됐는지도
          설명합니다.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="border-2 border-ink bg-surface p-5">
          <h2 className="text-lg font-bold">문제 그대로 넣기</h2>
          <label htmlFor="problem" className="mt-3 block text-sm text-pencil">
            문제 글을 붙여 넣거나 사진을 올리면 AI가 오른쪽 조건 표를 채웁니다.
          </label>
          <textarea
            id="problem"
            rows={9}
            className="mt-2 w-full resize-y border border-pencil/40 bg-paper p-3"
            placeholder="예) 다음 프로세스를 SRTF로 스케줄링할 때 평균 대기 시간을 구하시오. P1 도착 0 실행 8, P2 도착 1 실행 4 …"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="cursor-pointer border-2 border-ink bg-surface px-4 py-2 font-medium hover:bg-marker/60">
              사진 올리기
              <input type="file" accept="image/*" className="sr-only" onChange={() => setAiNote("x")} />
            </label>
            <button
              type="button"
              className="border-2 border-ink bg-surface px-4 py-2 font-medium hover:bg-marker/60"
              onClick={() => setAiNote("x")}
            >
              AI로 조건 채우기
            </button>
          </div>
          {aiNote && (
            <p role="status" className="mt-3 text-sm text-pencil">
              AI 문제 해석은 아직 연결되지 않았습니다. 지금은 오른쪽 표에 조건을 직접 입력하세요.
            </p>
          )}
        </section>

        <section className="border-2 border-ink bg-surface p-5">
          <h2 className="text-lg font-bold">조건 확인</h2>
          <div className="mt-3 flex gap-2" role="tablist">
            {(["scheduling", "paging"] as Kind[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={`border-2 border-ink px-3 py-1.5 font-medium ${kind === k ? "bg-ink text-paper" : "bg-surface"}`}
              >
                {k === "scheduling" ? "CPU 스케줄링" : "페이지 교체"}
              </button>
            ))}
          </div>

          {kind === "scheduling" ? (
            <div className="mt-4 space-y-4">
              <Field label="알고리즘">
                <select
                  value={sched.algorithm}
                  onChange={(e) => setSched({ ...sched, algorithm: e.target.value as SchedulingSpec["algorithm"] })}
                  className="border border-pencil/40 bg-paper px-2 py-1.5"
                >
                  {SCHED_ALGS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </Field>
              {sched.algorithm === "RR" && (
                <Field label="타임 퀀텀">
                  <input
                    type="number"
                    min={1}
                    value={sched.quantum ?? ""}
                    onChange={(e) => setSched({ ...sched, quantum: Number(e.target.value) || undefined })}
                    className="w-20 border border-pencil/40 bg-paper px-2 py-1.5"
                  />
                </Field>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[22rem] text-left">
                  <thead className="text-sm text-pencil">
                    <tr>
                      <th className="py-1 font-medium">이름</th>
                      <th className="py-1 font-medium">도착</th>
                      <th className="py-1 font-medium">실행</th>
                      {sched.algorithm === "PRIORITY" && <th className="py-1 font-medium">우선순위</th>}
                      <th className="sr-only">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sched.processes.map((p, k) => (
                      <tr key={k}>
                        {(["id", "arrival", "burst", ...(sched.algorithm === "PRIORITY" ? ["priority"] : [])] as const).map(
                          (f) => (
                            <td key={f} className="py-1 pr-2">
                              <input
                                aria-label={`${p.id} ${f}`}
                                type={f === "id" ? "text" : "number"}
                                value={p[f as keyof typeof p] ?? ""}
                                onChange={(e) => setProc(k, f as "id", e.target.value)}
                                className="w-full border border-pencil/40 bg-paper px-2 py-1"
                              />
                            </td>
                          ),
                        )}
                        <td>
                          <button
                            aria-label={`${p.id} 삭제`}
                            onClick={() => setSched({ ...sched, processes: sched.processes.filter((_, j) => j !== k) })}
                            className="px-2 text-pencil hover:text-fault"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() =>
                  setSched({
                    ...sched,
                    processes: [...sched.processes, { id: `P${sched.processes.length + 1}`, arrival: 0, burst: 1, priority: 1 }],
                  })
                }
                className="text-sm underline"
              >
                프로세스 추가
              </button>

              <fieldset className="border-t border-grid pt-3">
                <legend className="text-sm text-pencil">수업마다 다른 규칙</legend>
                <div className="mt-2 grid gap-2 text-sm">
                  <Toggle
                    checked={sched.rules.tieBreak === "id"}
                    onChange={(v) => rule("tieBreak", v ? "id" : "input")}
                    label="동시에 도착하면 이름 순 (끄면 입력 순서)"
                  />
                  {sched.algorithm === "RR" && (
                    <Toggle
                      checked={sched.rules.rrArrivalFirst}
                      onChange={(v) => rule("rrArrivalFirst", v)}
                      label="새로 도착한 프로세스를 퀀텀이 끝난 프로세스보다 큐 앞에"
                    />
                  )}
                  {sched.algorithm === "PRIORITY" && (
                    <>
                      <Toggle
                        checked={sched.rules.lowerIsHigher}
                        onChange={(v) => rule("lowerIsHigher", v)}
                        label="숫자가 작을수록 높은 우선순위"
                      />
                      <Toggle checked={sched.rules.preemptive} onChange={(v) => rule("preemptive", v)} label="선점형" />
                    </>
                  )}
                </div>
              </fieldset>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <Field label="알고리즘">
                <select
                  value={paging.algorithm}
                  onChange={(e) => setPaging({ ...paging, algorithm: e.target.value as PagingSpec["algorithm"] })}
                  className="border border-pencil/40 bg-paper px-2 py-1.5"
                >
                  {PAGE_ALGS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </Field>
              <Field label="프레임 수">
                <input
                  type="number"
                  min={1}
                  value={paging.frames}
                  onChange={(e) => setPaging({ ...paging, frames: Number(e.target.value) })}
                  className="w-20 border border-pencil/40 bg-paper px-2 py-1.5"
                />
              </Field>
              <label className="block">
                <span className="text-sm text-pencil">참조열 (공백이나 쉼표로 구분)</span>
                <input
                  value={refsText}
                  onChange={(e) => setRefsText(e.target.value)}
                  className="mt-1 w-full border border-pencil/40 bg-paper px-2 py-1.5"
                />
              </label>
            </div>
          )}

          {errors.length > 0 && (
            <ul role="alert" className="mt-4 list-disc pl-5 text-sm text-fault">
              {errors.map((e, k) => (
                <li key={k}>{e}</li>
              ))}
            </ul>
          )}
          <button onClick={run} className="mt-5 w-full border-2 border-ink bg-ink py-3 text-lg font-bold text-paper hover:bg-ink/90">
            한 단계씩 풀어 보기
          </button>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-20 text-sm text-pencil">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-ink" />
      {label}
    </label>
  );
}
