/**
 * POST /api/teams/{teamId}/ai — 진짜 팀 대화방의 '@AI 요약 · 할 일 정리 · 자료 정리' (B 앱 카드)
 * body: { text: "@AI 할 일 정리해줘" }  →  { ok: true, data: AiReply }
 * 회의록(9): { text: "@AI 회의록 정리해줘", memo?: 붙여 넣은 회의 메모, window?: { startAt, endAt } 이 시간 대화만 읽기 }
 * 회의 잡기는 여기서 하지 않고 C(/api/scheduling/teams/{teamId})로 가요.
 */
import { runTeamAi, TeamAiError } from "@/server/team-ai";
import { AI_BUSY_MESSAGE, isAiBusy } from "@/server/gemini-generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const body = (await request.json().catch(() => null)) as { text?: unknown; memo?: unknown; window?: { startAt?: unknown; endAt?: unknown } } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 500) : "";
  const memo = typeof body?.memo === "string" ? body.memo.trim().slice(0, 6000) : "";
  const w = body?.window;
  const window =
    w && typeof w.startAt === "string" && typeof w.endAt === "string" && Number.isFinite(Date.parse(w.startAt)) && Number.isFinite(Date.parse(w.endAt))
      ? { startAt: w.startAt, endAt: w.endAt }
      : undefined;
  if (!text) return Response.json({ ok: false, error: { message: "부탁할 내용을 적어 주세요" } }, { status: 400 });
  try {
    return Response.json({ ok: true, data: await runTeamAi(request, teamId, text, { memo: memo || undefined, window }) });
  } catch (e) {
    if (e instanceof TeamAiError) return Response.json({ ok: false, error: { message: e.message } }, { status: e.status });
    if (isAiBusy(e)) return Response.json({ ok: false, error: { message: AI_BUSY_MESSAGE } }, { status: 503 });
    console.error("[team-ai] failed:", e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : String(e).slice(0, 200));
    return Response.json({ ok: false, error: { message: "AI가 정리하지 못했어요 · 잠시 뒤 다시 부탁해 주세요" } }, { status: 503 });
  }
}
