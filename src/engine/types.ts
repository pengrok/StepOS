export type {
  Process,
  SchedulingRules,
  SchedulingSpec,
  SchedulingAlgorithm,
  PagingSpec,
  PagingAlgorithm,
  ProblemSpec,
} from "../lib/schema";

// "왜 이것이 선택/교체됐나"의 근거. LLM은 이 값만 문장으로 풀어 쓴다.
export type Reason = {
  rule: string; // 적용한 규칙 (예: "남은 시간이 가장 짧은 프로세스")
  metric: string; // 비교한 값의 이름 (예: "remaining", "responseRatio", "lastUsed")
  candidates: { id: string; value: number | null }[]; // null = 비교값 없음(앞으로 다시 안 쓰임 등)
  chosen: string;
};

// ---------- CPU 스케줄링 ----------

export type SchedEvent =
  | { type: "arrive"; id: string }
  | { type: "dispatch"; id: string; reason: Reason }
  | { type: "preempt"; id: string; by: string | null; cause: "quantum" | "better"; reason?: Reason }
  | { type: "complete"; id: string }
  | { type: "idle" };

export type SchedStep = {
  time: number;
  events: SchedEvent[];
  running: string | null; // 이 시각부터 실행되는 프로세스
  readyQueue: string[]; // 결정 후 준비 큐 (실행 중 제외)
  remaining: Record<string, number>;
};

export type GanttSegment = { id: string | null; start: number; end: number }; // id null = CPU 쉼

export type ProcessResult = {
  id: string;
  arrival: number;
  burst: number;
  start: number; // 처음 실행된 시각
  completion: number;
  turnaround: number;
  waiting: number;
  response: number;
};

export type SchedulingTrace = {
  kind: "scheduling";
  steps: SchedStep[];
  gantt: GanttSegment[];
  processes: ProcessResult[];
  avgWaiting: number;
  avgTurnaround: number;
  avgResponse: number;
};

// ---------- 페이지 교체 ----------

export type PagingStep = {
  index: number; // 참조열 위치 (0부터)
  page: number;
  hit: boolean;
  slot: number | null; // 적중/적재된 프레임 번호
  victim: number | null; // 쫓겨난 페이지
  frames: (number | null)[]; // 이 참조 처리 후 프레임 상태
  reason?: Reason; // 교체가 일어났을 때만
};

export type PagingTrace = {
  kind: "paging";
  steps: PagingStep[];
  faults: number;
  hits: number;
};

export type Trace = SchedulingTrace | PagingTrace;
