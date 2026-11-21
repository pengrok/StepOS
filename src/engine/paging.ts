import type { PagingSpec, PagingStep, PagingTrace, Reason } from "./types";

const RULES: Record<PagingSpec["algorithm"], { rule: string; metric: string }> = {
  FIFO: { rule: "가장 먼저 적재된 페이지를 교체", metric: "loadedAt" },
  LRU: { rule: "가장 오래 전에 사용된 페이지를 교체", metric: "lastUsed" },
  OPT: { rule: "앞으로 가장 늦게 사용될(또는 다시 안 쓰일) 페이지를 교체", metric: "nextUse" },
};

export function simulatePaging(spec: PagingSpec): PagingTrace {
  const { algorithm: alg, references: refs } = spec;
  const frames: (number | null)[] = Array(spec.frames).fill(null);
  const loadedAt = new Map<number, number>();
  const lastUsed = new Map<number, number>();
  const steps: PagingStep[] = [];

  refs.forEach((page, i) => {
    let slot = frames.indexOf(page);
    let victim: number | null = null;
    let reason: Reason | undefined;
    const hit = slot !== -1;

    if (!hit) {
      slot = frames.indexOf(null);
      if (slot === -1) {
        const resident = frames as number[];
        // OPT에서 다시 안 쓰이는 페이지는 null(무한대)로 표시한다
        const value = (p: number): number | null => {
          if (alg === "FIFO") return loadedAt.get(p)!;
          if (alg === "LRU") return lastUsed.get(p)!;
          const n = refs.indexOf(p, i + 1);
          return n === -1 ? null : n;
        };
        const key = (p: number) => {
          const v = value(p);
          return alg === "OPT" ? -(v ?? Infinity) : v!; // 작을수록 교체 대상
        };
        // 동점(OPT에서 여러 페이지가 다시 안 쓰임)은 먼저 적재된 페이지
        victim = resident.reduce((best, p) =>
          key(p) < key(best) || (key(p) === key(best) && loadedAt.get(p)! < loadedAt.get(best)!) ? p : best,
        );
        slot = frames.indexOf(victim);
        reason = { ...RULES[alg], candidates: resident.map((p) => ({ id: String(p), value: value(p) })), chosen: String(victim) };
        loadedAt.delete(victim);
        lastUsed.delete(victim);
      }
      frames[slot] = page;
      loadedAt.set(page, i);
    }
    lastUsed.set(page, i);
    steps.push({ index: i, page, hit, slot, victim, frames: [...frames], reason });
  });

  const faults = steps.filter((s) => !s.hit).length;
  return { kind: "paging", steps, faults, hits: refs.length - faults };
}
