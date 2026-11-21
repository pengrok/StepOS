import { simulatePaging } from "./paging";
import { simulateScheduling } from "./scheduling";
import type { PagingTrace, ProblemSpec, SchedulingTrace } from "./types";

export function simulate(spec: Extract<ProblemSpec, { kind: "scheduling" }>): SchedulingTrace;
export function simulate(spec: Extract<ProblemSpec, { kind: "paging" }>): PagingTrace;
export function simulate(spec: ProblemSpec): SchedulingTrace | PagingTrace;
export function simulate(spec: ProblemSpec) {
  return spec.kind === "scheduling" ? simulateScheduling(spec) : simulatePaging(spec);
}

export { simulatePaging, simulateScheduling };
export * from "./diagnose";
export type * from "./types";
