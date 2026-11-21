import type { ProblemSpec } from "./schema";

// 화면 설계안과 데모에 쓰는 교재 예제
export const SAMPLE_SCHEDULING = {
  kind: "scheduling",
  algorithm: "SRTF",
  processes: [
    { id: "P1", arrival: 0, burst: 8 },
    { id: "P2", arrival: 1, burst: 4 },
    { id: "P3", arrival: 2, burst: 9 },
    { id: "P4", arrival: 3, burst: 5 },
  ],
  quantum: 2,
  rules: { tieBreak: "input", rrArrivalFirst: true, lowerIsHigher: true, preemptive: false },
  assumptions: ["동시 도착 시 입력 순서대로 처리"],
} satisfies ProblemSpec;

export const SAMPLE_PAGING = {
  kind: "paging",
  algorithm: "LRU",
  frames: 3,
  references: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1],
  assumptions: [],
} satisfies ProblemSpec;

export const encodeSpec = (spec: ProblemSpec) => encodeURIComponent(JSON.stringify(spec));

// 프로세스별 색 (모눈종이 위에서 서로 구분되는 색연필 톤)
export const PROCESS_COLORS = ["#3d6fd9", "#e0892b", "#8a55c9", "#2e9e8f", "#c94f7c", "#7a8c2e"];
