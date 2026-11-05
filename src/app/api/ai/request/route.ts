/**
 * POST /api/ai/request  { teamId, text, extraMessages? }
 * → AiRequestResponse (src/lib/data.ts)
 *
 * 1. B(회의 조건): GEMINI_API_KEY가 있으면 B 모듈(src/server/b/mvp.ts의 handleAiRequest)이 실제 AI로 대화를 읽어요.
 *    키가 없으면 예시 조건(src/mocks/b-conditions.json)을 써요.
 * 2. C(시간 후보 · 회의 제안): B의 조건으로 C의 createProposal이 실제로 시간 후보를 계산해요 (키 없어도 돌아가요).
 * 3. 장소 종류: 대화와 B의 조건에서 골라요 (src/lib/place-intent.ts). 장소 자체는 6에서 찾아요.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getDemoConditions, getMember, getMemberOrigin, getMessages, getProposal, getTeam, type AiRequestResponse } from "@/lib/data";
import { handleAiRequest } from "@/server/b/mvp";
import { geminiGenerate } from "@/server/gemini-generate";
import { seoulDate, toExtractionInput, toReply } from "@/server/ai-adapter";
import { inferPlaceIntent, placeIntentFrom } from "@/lib/place-intent";
import { buildProposal } from "@/server/proposal-adapter";
import type { Conditions } from "@/server/b/b-c-contract";
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

  const allMessages = [...getMessages(team.id), ...extra];
  const nameOf = (id: string) => getMember(id).name;
  const base = getProposal("p-1"); // 이 팀의 진행 중인 제안 자리 (응답 마감 등 C가 정하지 않는 값을 이어받아요)
  /** C로 시간 후보를 계산해서 화면용 제안을 만들어요. 실패해도 대화방은 계속 쓸 수 있게 null */
  const proposalFrom = async (conditions: Conditions | undefined | null) => {
    if (!conditions || base.teamId !== team.id) return null;
    try {
      return await buildProposal({ conditions, base, nameOf, messages: allMessages });
    } catch (err) {
      console.error("[ai/request] C 실패", err);
      return null;
    }
  };

  if (!process.env.GEMINI_API_KEY) {
    // 키가 없으면 B 대신 예시 조건으로 C를 돌려요. 장소 종류는 대화에서 골라요.
    const conditions = getDemoConditions(team.id) as Conditions | null;
    const built = await proposalFrom(conditions);
    const data: AiRequestResponse = {
      source: "mock",
      placeIntent: inferPlaceIntent(conditions ? [...chatTexts, conditions.purpose, ...conditions.placeRequirements] : chatTexts),
      ...(built ? { proposal: built.proposal, warnings: built.warnings } : {}),
    };
    return NextResponse.json(data);
  }

  const members = team.memberIds.map((id) => ({ memberId: id, name: getMember(id).name, station: getMemberOrigin(id) ?? null }));
  const input = toExtractionInput({ team, members, messages: allMessages, referenceDate: seoulDate() });

  try {
    const result = await handleAiRequest(text, input, geminiGenerate);
    // B가 정한 장소 종류(placeType)를 먼저 쓰고, 없으면 목적·필요한 장소·안건·대화에서 골라요
    const c = result.status === "ready" ? result.conditions : result.status === "needs_confirmation" ? result.draft : undefined;
    const placeIntent = placeIntentFrom(c?.placeType, c ? [c.purpose, ...c.placeRequirements, ...c.agenda, ...chatTexts] : chatTexts);
    const built = await proposalFrom(c);
    const data: AiRequestResponse = {
      source: "gemini",
      status: result.status,
      placeIntent,
      reply: toReply(result, nameOf, placeIntent),
      // C가 시간 후보를 하나라도 찾았을 때만 제안 카드를 보여줘요
      canPropose: !!built,
      ...(built ? { proposal: built.proposal, warnings: built.warnings } : {}),
    };
    return NextResponse.json(data);
  } catch (err) {
    // AI 호출 실패, 잘못된 JSON, 입력 검증 실패 등 (B가 Error를 던져요)
    console.error("[ai/request]", err);
    return NextResponse.json({ error: { code: "B_FAILED", message: "AI가 대화를 정리하지 못했어요" } }, { status: 502 });
  }
}
