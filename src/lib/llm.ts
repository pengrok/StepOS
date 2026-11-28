import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// AI 공급사 선택은 이 파일에서만 한다. 서버 코드에서만 import한다 (API 키는 서버 환경변수에만 있음).
//
// 환경변수
//   LLM_PROVIDER  google | openai   (없으면 키가 있는 쪽을 씀)
//   LLM_MODEL     모델 이름          (없으면 아래 기본값)
//   GOOGLE_GENERATIVE_AI_API_KEY 또는 OPENAI_API_KEY

const DEFAULT_MODEL = { google: "gemini-flash-latest", openai: "gpt-5.5" } as const;

export type LlmConfig = { provider: "google" | "openai"; modelId: string; model: LanguageModel };

export function getLlm(): LlmConfig | null {
  const env = process.env;
  const provider =
    env.LLM_PROVIDER === "google" || env.LLM_PROVIDER === "openai"
      ? env.LLM_PROVIDER
      : env.GOOGLE_GENERATIVE_AI_API_KEY
        ? "google"
        : env.OPENAI_API_KEY
          ? "openai"
          : null;
  if (!provider) return null;
  const hasKey = provider === "google" ? !!env.GOOGLE_GENERATIVE_AI_API_KEY : !!env.OPENAI_API_KEY;
  if (!hasKey) return null;
  const modelId = env.LLM_MODEL || DEFAULT_MODEL[provider];
  return { provider, modelId, model: provider === "google" ? google(modelId) : openai(modelId) };
}
