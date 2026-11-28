// SECURITY: LLM10 (Unbounded Consumption) — 요청 수 제한, 시간당 토큰 한도, 하루 전체 토큰 차단기
// OWASP: Top 10 for LLM Applications 2025 (v2025.1, published November 2025)
// Confidence: MODERATE — 로그인이 없어 사용자 대신 IP 기준. 메모리 저장이라 서버 인스턴스마다 따로 셈
// Level: Moderate
// Declined: High (등급별 한도, 주입 분류기) — 공모전 규모, 로그인 없음
// Pattern: token_budget_limiter (in-memory)
// Requires layering: 배포 규모가 커지면 공유 저장소(Redis 등)로 옮기고 로그인 기반 사용자 식별 추가
// Applied by: llm-secure-patterns v1.0.0 / LLM Endpoint Hardening
// Date applied: 2026-11-28

type Bucket = { start: number; count: number; tokens: number };

export type LimitConfig = {
  windowMs: number;
  maxRequests: number; // 창 안에서 IP별 최대 요청 수
  maxTokens: number; // 창 안에서 IP별 최대 토큰
  dailyTokens: number; // 하루 전체 토큰 상한 (넘으면 차단기 작동)
};

export function createLimiter(cfg: LimitConfig, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();
  let day = { start: now(), tokens: 0 };

  const bucket = (key: string) => {
    const t = now();
    let b = buckets.get(key);
    if (!b || t - b.start >= cfg.windowMs) {
      b = { start: t, count: 0, tokens: 0 };
      buckets.set(key, b);
    }
    if (buckets.size > 10_000) buckets.clear(); // shortcut: 메모리 보호용 단순 정리, 규모가 커지면 외부 저장소로
    return b;
  };

  return {
    // 호출 전에 검사하고 요청 수를 예약한다
    check(key: string): { ok: true } | { ok: false; reason: "rate" | "tokens" | "daily"; retryAfterSec: number } {
      const t = now();
      if (t - day.start >= 86_400_000) day = { start: t, tokens: 0 };
      if (day.tokens >= cfg.dailyTokens)
        return { ok: false, reason: "daily", retryAfterSec: Math.ceil((day.start + 86_400_000 - t) / 1000) };
      const b = bucket(key);
      const retryAfterSec = Math.ceil((b.start + cfg.windowMs - t) / 1000);
      if (b.count >= cfg.maxRequests) return { ok: false, reason: "rate", retryAfterSec };
      if (b.tokens >= cfg.maxTokens) return { ok: false, reason: "tokens", retryAfterSec };
      b.count++;
      return { ok: true };
    },
    // 호출 뒤 실제 사용한 토큰을 기록한다
    record(key: string, tokens: number) {
      bucket(key).tokens += tokens;
      day.tokens += tokens;
    },
  };
}
