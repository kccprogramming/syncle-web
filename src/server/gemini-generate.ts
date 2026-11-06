/**
 * B(성하)에게 넘기는 Gemini 호출 함수 — B 코드는 그대로 두고 여기서만 맞춰요.
 *
 * B의 handleAiRequest(text, input, generate)는 generate를 넘기면 그걸로 AI를 불러요. 여기서 다섯 가지를 해요.
 *
 * 1. 모델: GEMINI_MODEL이 없으면 gemini-3.1-flash-lite를 써요.
 *    (B 최신 86eed61의 기본값 gemini-2.5-flash는 새 사용자에게 막혀 있어 404가 나요 — 11/6 확인)
 * 2. 시간 다듬기: AI가 '하루 종일'을 23:59:59처럼 초를 붙여 쓰면 B 검사(초는 00)에서 제안이 통째로 실패해요.
 *    그래서 AI 답의 시각 글자 중 초가 있는 것을 분 단위로 맞춰요.
 *    - 59초 이상이면 다음 분으로 올려요 (23:59:59 → 다음 날 00:00:00)
 *    - 나머지는 초를 버려요 (10:30:15 → 10:30:00)
 * 3. 출발지 목록 채우기: B 검사는 origins에 팀원이 모두 있어야 통과시키는데, B 최신 프롬프트에서
 *    '출발역을 모르면 null' 규칙이 빠져 AI가 origins를 비워 둘 때가 있어요. 빠진 팀원을 { station: null }로 채워요.
 *    (앱은 이 값을 쓰지 않아요 — 정확한 출발지는 서버가 A 005로 따로 읽고, C도 origins를 비워 저장해요)
 * 4. 겹치는 시간 정리: AI가 한 사람의 '되는 시간'과 '안 되는 시간'을 겹치게 쓰면 B 검사(conflicting slots)에서
 *    제안이 통째로 실패해요. 겹치는 부분은 '안 되는 시간'으로 보고 '되는 시간'에서 빼요 (안 된다고 한 때에 잡지 않게).
 * 5. 기간 밖 시간 자르기: AI가 찾는 기간(searchWindow) 밖 날짜를 넣으면 B 검사(availableSlots)에서 실패해요.
 *    모든 시간 구간을 기간 안으로 자르고, 다 잘려 나간 구간은 빼요.
 * 2 · 3 · 4 · 5는 성하님이 B 프롬프트 · 검사에서 고쳐 주면 지워도 돼요 (docs/HANDOFF.md 7장).
 *    11/6 B 43f89ea(규칙 복구)로 실제 팀 대화를 돌려도 B만으로는 4번 중 1번만 통과해서 아직 필요해요.
 */
import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeScheduleOutput, scheduleTimeSummary } from "./normalize-schedule-output";
export { roundToMinute } from "./normalize-schedule-output";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

/** B의 GenerateText 모양: 프롬프트 → AI가 쓴 JSON 글자 */
export async function geminiGenerate(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is required.");
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });
  const text = (await model.generateContent(prompt)).response.text();
  try {
    const original: unknown = JSON.parse(text);
    const normalized = normalizeScheduleOutput(original);
    const before = scheduleTimeSummary(original);
    if (before.length) console.info("[scheduling] time normalization", JSON.stringify({ before, after: scheduleTimeSummary(normalized) }));
    return JSON.stringify(normalized);
  } catch {
    return text; // JSON이 아니면 B가 알아서 실패 처리해요
  }
}

/** Gemini 사용량 한도(분당 · 하루)에 걸렸는지 — 무료 키는 여러 명이 연달아 부르면 잠깐 막혀요 */
export function isAiBusy(error: unknown): boolean {
  const status = error && typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : NaN;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return status === 429 || /\b429\b|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(message);
}

/** 화면에 보여줄 사용량 초과 안내 */
export const AI_BUSY_MESSAGE = "AI 사용량이 잠시 많아요 · 1분 뒤 다시 부탁해 주세요";
