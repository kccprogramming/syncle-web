/**
 * B(성하)에게 넘기는 Gemini 호출 함수 — B 코드는 그대로 두고 여기서만 맞춰요.
 *
 * B의 handleAiRequest(text, input, generate)는 generate를 넘기면 그걸로 AI를 불러요. 여기서 세 가지를 해요.
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
 * 2 · 3은 성하님이 B 프롬프트 · 검사에서 고쳐 주면 지워도 돼요 (docs/HANDOFF.md 7장).
 */
import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

/** 2026-11-09T23:59:59+09:00 같은 시각 (초 · 소수초 · 시간대 포함) */
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** 시각 글자 하나를 분 단위로 맞춰요. 시각이 아니거나 이미 맞으면 그대로 돌려줘요 */
export function roundToMinute(value: string): string {
  const m = TIMESTAMP.exec(value);
  if (!m) return value;
  const [, y, mo, d, h, mi, s, frac, zone] = m;
  const seconds = Number(s) + (frac ? Number(frac) : 0);
  if (seconds === 0 && !frac) return value;
  // 시간대 그대로 두고 '벽시계' 시각만 계산해요
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) + (seconds >= 59 ? 60_000 : 0);
  const t = new Date(wall).toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  return `${t}:00${zone}`;
}

/** JSON 안의 모든 시각 글자를 다듬어요 */
function roundAll(value: unknown): unknown {
  if (typeof value === "string") return roundToMinute(value);
  if (Array.isArray(value)) return value.map(roundAll);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, roundAll(v)]));
  return value;
}

/** 회의 조건(B Conditions) 모양이면 origins에 빠진 팀원을 { station: null }로 채워요 */
function fillOrigins(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const c = value as { origins?: unknown; schedule?: { members?: unknown } };
  const members = c.schedule?.members;
  if (!Array.isArray(members) || (c.origins !== undefined && !Array.isArray(c.origins))) return value;
  const origins = (c.origins ?? []) as { memberId?: unknown }[];
  const have = new Set(origins.map((o) => o?.memberId));
  const missing = members
    .map((m) => (m as { memberId?: unknown })?.memberId)
    .filter((id): id is string => typeof id === "string" && !have.has(id))
    .map((memberId) => ({ memberId, station: null }));
  return missing.length ? { ...c, origins: [...origins, ...missing] } : value;
}

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
    return JSON.stringify(fillOrigins(roundAll(JSON.parse(text))));
  } catch {
    return text; // JSON이 아니면 B가 알아서 실패 처리해요
  }
}
