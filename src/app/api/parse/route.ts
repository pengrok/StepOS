import { getLlm } from "@/lib/llm";
import { LIMITS, parseProblem } from "@/lib/parseProblem";
import { createLimiter } from "@/lib/rateLimit";

// POST /api/parse (multipart/form-data: text, image) → { spec, notes } 또는 { error }

// SECURITY: LLM10 (Unbounded Consumption) — 입력 크기 제한, 출력 토큰 상한, IP별 요청·토큰 한도, 하루 전체 토큰 차단기, 30초 시간 제한, 키는 서버 환경변수에만
// OWASP: Top 10 for LLM Applications 2025 (v2025.1, published November 2025)
// Confidence: MODERATE — 로그인이 없어 IP 기준 제한. 한도는 서버 인스턴스마다 따로 셈
// Level: Moderate
// Declined: High (등급별 한도, 우선순위 큐, 주입 분류기) — 로그인 없는 공모전 앱
// Pattern: token_budget_limiter
// Requires layering: 출력 검증(parseProblem의 ProblemSpecSchema), 공유 저장소 기반 한도(배포 규모가 커질 때)
// Applied by: llm-secure-patterns v1.0.0 / LLM Endpoint Hardening
// Date applied: 2026-11-28
const limiter = createLimiter({
  windowMs: 10 * 60_000,
  maxRequests: Number(process.env.PARSE_MAX_REQUESTS_PER_10MIN ?? 10),
  maxTokens: Number(process.env.PARSE_MAX_TOKENS_PER_10MIN ?? 40_000),
  dailyTokens: Number(process.env.PARSE_DAILY_TOKEN_LIMIT ?? 1_000_000),
});

export const maxDuration = 60;

const error = (status: number, message: string, headers?: HeadersInit) =>
  Response.json({ error: message }, { status, headers });

export async function POST(request: Request) {
  const llm = getLlm();
  if (!llm) return error(503, "AI 문제 해석이 아직 설정되지 않았습니다. 오른쪽 표에 직접 입력하세요.");

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > LIMITS.imageBytes + LIMITS.textChars * 4 + 64_000) return error(413, "사진은 4MB 이하로 올려 주세요.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "요청 형식이 올바르지 않습니다.");
  }
  const text = form.get("text");
  const image = form.get("image");
  if (text !== null && typeof text !== "string") return error(400, "문제 글 형식이 올바르지 않습니다.");
  if (text && text.length > LIMITS.textChars) return error(413, `문제 글은 ${LIMITS.textChars}자 이하로 넣어 주세요.`);
  if (image !== null && !(image instanceof File)) return error(400, "사진 형식이 올바르지 않습니다.");
  if (image && image.size > 0) {
    if (image.size > LIMITS.imageBytes) return error(413, "사진은 4MB 이하로 올려 주세요.");
    if (!LIMITS.imageTypes.includes(image.type)) return error(415, "사진은 PNG, JPG, WEBP 형식만 올릴 수 있습니다.");
  }
  const hasImage = image instanceof File && image.size > 0;
  if (!text?.trim() && !hasImage) return error(400, "문제 글을 넣거나 사진을 올려 주세요.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const allowed = limiter.check(ip);
  if (!allowed.ok)
    return error(
      429,
      allowed.reason === "daily"
        ? "오늘 AI 사용량이 모두 찼습니다. 오른쪽 표에 직접 입력하세요."
        : `요청이 너무 많습니다. ${Math.ceil(allowed.retryAfterSec / 60)}분 뒤에 다시 시도하세요.`,
      { "Retry-After": String(allowed.retryAfterSec) },
    );

  try {
    const result = await parseProblem(
      llm.model,
      {
        text: text ?? undefined,
        image: hasImage ? { data: new Uint8Array(await image.arrayBuffer()), mediaType: image.type } : undefined,
      },
      AbortSignal.timeout(30_000),
    );
    limiter.record(ip, result.tokens);
    // 문제 내용은 기록하지 않는다. 비용 추적용 토큰 수만 남긴다.
    console.log(JSON.stringify({ route: "parse", provider: llm.provider, model: llm.modelId, ok: result.ok, tokens: result.tokens }));
    return result.ok ? Response.json({ spec: result.spec, notes: result.notes }) : error(422, result.message);
  } catch (e) {
    console.error(JSON.stringify({ route: "parse", error: e instanceof Error ? e.name : "unknown" }));
    return error(502, "AI가 응답하지 않았습니다. 잠시 뒤 다시 시도하거나 오른쪽 표에 직접 입력하세요.");
  }
}
