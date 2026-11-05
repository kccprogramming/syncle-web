/**
 * POST /api/ai/request  { teamId, text, extraMessages? }
 * → AiRequestResponse (src/lib/data.ts)
 *
 * GEMINI_API_KEY가 있으면 B 모듈(src/server/b/mvp.ts의 handleAiRequest)이 실제 AI로 대화를 읽고,
 * 없으면 { source: "mock" }을 돌려줘서 화면이 지금까지의 예시 흐름을 그대로 보여줘요.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getMember, getMemberOrigin, getMessages, getTeam, type AiRequestResponse } from "@/lib/data";
import { handleAiRequest } from "@/server/b/mvp";
import { seoulDate, toExtractionInput, toReply } from "@/server/ai-adapter";
import { inferPlaceIntent } from "@/lib/place-intent";
import type { Message } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { teamId?: string; text?: string; extraMessages?: Message[] };
  const text = String(body.text ?? "").slice(0, 1000);
  const team = getTeam(String(body.teamId ?? ""));
  const extra = Array.isArray(body.extraMessages) ? body.extraMessages.slice(-50) : [];
  // 부탁 글 → 최근 메시지 순으로 근거를 찾아요 (최근 말이 우선)
  const chatTexts = [text, ...[...getMessages(team.id), ...extra].reverse().flatMap((m) => (m.type === "text" || m.type === "mention-ai" ? [m.text] : []))];

  if (!process.env.GEMINI_API_KEY) {
    // 키가 없어도 장소 종류는 대화에서 골라 둬요 (시간 후보·조건 카드는 예시 흐름)
    const data: AiRequestResponse = { source: "mock", placeIntent: inferPlaceIntent(chatTexts) };
    return NextResponse.json(data);
  }

  const members = team.memberIds.map((id) => ({ memberId: id, name: getMember(id).name, station: getMemberOrigin(id) ?? null }));
  const input = toExtractionInput({ team, members, messages: [...getMessages(team.id), ...extra], referenceDate: seoulDate() });

  try {
    const result = await handleAiRequest(text, input);
    // B가 뽑은 목적·필요한 장소·안건을 먼저 보고, 없으면 대화에서 골라요
    const c = result.status === "ready" ? result.conditions : result.status === "needs_confirmation" ? result.draft : undefined;
    const placeIntent = inferPlaceIntent(c ? [c.purpose, ...c.placeRequirements, ...c.agenda, ...chatTexts] : chatTexts);
    const data: AiRequestResponse = {
      source: "gemini",
      status: result.status,
      placeIntent,
      reply: toReply(result, (id) => getMember(id).name, placeIntent),
      canPropose: result.status === "ready" || (result.status === "needs_confirmation" && !!result.draft),
    };
    return NextResponse.json(data);
  } catch (err) {
    // AI 호출 실패, 잘못된 JSON, 입력 검증 실패 등 (B가 Error를 던져요)
    console.error("[ai/request]", err);
    return NextResponse.json({ error: { code: "B_FAILED", message: "AI가 대화를 정리하지 못했어요" } }, { status: 502 });
  }
}
