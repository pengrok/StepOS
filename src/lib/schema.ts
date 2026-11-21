import { z } from "zod";

// 문제 조건 형식. AI 문제 해석 결과와 직접 입력 폼 모두 이 스키마로 검증한다.

const id = z.string().trim().min(1).max(20);
const nonNegInt = z.number().int().min(0).max(10_000);

export const ProcessSchema = z.object({
  id,
  arrival: nonNegInt,
  burst: z.number().int().min(1).max(10_000),
  priority: z.number().int().optional(),
});

export const SchedulingRulesSchema = z.object({
  // 비교값이 같을 때(동시 도착 등) 누구를 먼저 둘지: 입력 순서 또는 프로세스 이름 순
  tieBreak: z.enum(["input", "id"]).default("input"),
  // RR: 같은 시각에 새로 도착한 프로세스를 타임 퀀텀이 끝난 프로세스보다 큐 앞에 넣는다
  rrArrivalFirst: z.boolean().default(true),
  // 우선순위: 숫자가 작을수록 높은 우선순위
  lowerIsHigher: z.boolean().default(true),
  // 우선순위: 선점형 여부
  preemptive: z.boolean().default(false),
});

export const SchedulingSpecSchema = z
  .object({
    kind: z.literal("scheduling"),
    algorithm: z.enum(["FCFS", "SJF", "SRTF", "HRN", "RR", "PRIORITY"]),
    processes: z.array(ProcessSchema).min(1).max(26),
    quantum: z.number().int().min(1).max(1_000).optional(),
    rules: SchedulingRulesSchema.prefault({}),
    assumptions: z.array(z.string().max(200)).max(10).default([]),
  })
  .superRefine((s, ctx) => {
    const ids = s.processes.map((p) => p.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "프로세스 이름이 중복됩니다", path: ["processes"] });
    if (s.algorithm === "RR" && s.quantum === undefined)
      ctx.addIssue({ code: "custom", message: "RR에는 타임 퀀텀이 필요합니다", path: ["quantum"] });
    if (s.algorithm === "PRIORITY" && s.processes.some((p) => p.priority === undefined))
      ctx.addIssue({ code: "custom", message: "모든 프로세스에 우선순위가 필요합니다", path: ["processes"] });
  });

export const PagingSpecSchema = z.object({
  kind: z.literal("paging"),
  algorithm: z.enum(["FIFO", "LRU", "OPT"]),
  frames: z.number().int().min(1).max(10),
  references: z.array(nonNegInt).min(1).max(100),
  assumptions: z.array(z.string().max(200)).max(10).default([]),
});

export const ProblemSpecSchema = z.discriminatedUnion("kind", [SchedulingSpecSchema, PagingSpecSchema]);

export type Process = z.infer<typeof ProcessSchema>;
export type SchedulingRules = z.infer<typeof SchedulingRulesSchema>;
export type SchedulingSpec = z.infer<typeof SchedulingSpecSchema>;
export type SchedulingAlgorithm = SchedulingSpec["algorithm"];
export type PagingSpec = z.infer<typeof PagingSpecSchema>;
export type PagingAlgorithm = PagingSpec["algorithm"];
export type ProblemSpec = z.infer<typeof ProblemSpecSchema>;
