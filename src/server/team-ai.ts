/**
 * 진짜 팀의 '@AI 요약 · 할 일 정리 · 자료 정리 · 회의록' — B(성하) analyzeAiCard를 불러 대화방 답 카드(AiReply)로 바꿔요.
 *
 * - 누가 부르는지는 로그인 토큰(Authorization: Bearer)으로 확인하고, 대화는 그 사람의 권한(RLS)으로 읽어요.
 * - B는 대화 · 팀 설정(AI 꺼짐 · @AI만 읽기) · 이미 있는 할 일을 받아 '제안'만 돌려줘요. 저장은 사람이 '추가'를 눌러야 해요.
 * - 요청 종류 · 오늘 날짜 · 팀원 이름/id · 근거 형식은 B(aedb6b1 이후)가 직접 프롬프트에 넣어요.
 *   앱은 ① 요청 종류 다시 한 번(B 프롬프트가 세 가지 모양을 tasks부터 다 보여 줘서 요약 · 자료를 부탁해도 할 일 카드가 나와요 — 11/6 밤 확인)
 *   ② 지어내지 않기 ③ 회의록용 '회의 메모'(B에 메모 칸이 없어서)만 덧붙여요.
 */
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { classifyRequest, handleAiRequest } from "@/server/b/mvp";
import type { ExtractionInput } from "@/server/b/b-c-contract";
import { geminiGenerate } from "@/server/gemini-generate";
import { cardReply, type CardKind } from "@/server/ai-adapter";
import type { AiReply } from "@/types";

export class TeamAiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const LABEL: Record<CardKind, string> = { summary: "대화 요약", tasks: "할 일 정리", files: "공유된 자료 정리", minutes: "회의록 정리" };
const CARD_KINDS = Object.keys(LABEL) as CardKind[];

/** 오늘 서울 날짜 "2026-11-06" */
function seoulDate(now = Date.now()) {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}

export type TeamAiOptions = {
  /** 회의록: 직접 붙여 넣은 회의 메모 (대화와 함께 읽어요) */
  memo?: string;
  /** 회의록: 이 시간 동안의 대화만 읽어요 */
  window?: { startAt: string; endAt: string };
};

export async function runTeamAi(request: Request, teamId: string, text: string, options: TeamAiOptions = {}): Promise<AiReply> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token) throw new TeamAiError(401, "먼저 로그인해 주세요");
  if (!url || !key) throw new TeamAiError(503, "서버 Supabase 설정이 필요해요");
  if (!process.env.GEMINI_API_KEY) throw new TeamAiError(503, "AI 설정(GEMINI_API_KEY)이 없어요");

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth } = await db.auth.getUser(token);
  const userId = auth.user?.id;
  if (!userId) throw new TeamAiError(401, "로그인 상태를 확인해 주세요");

  const [team, members, tasks] = await Promise.all([
    db.from("teams").select("id,ai_enabled,ai_read_scope").eq("id", teamId).maybeSingle(),
    db.from("team_members").select("member_id").eq("team_id", teamId),
    db.from("team_tasks").select("title").eq("team_id", teamId).eq("is_complete", false),
  ]);
  if (team.error || members.error) throw new TeamAiError(503, "팀 정보를 읽지 못했어요");
  const ids = (members.data ?? []).map((m) => String(m.member_id));
  if (!team.data || !ids.includes(userId)) throw new TeamAiError(403, "이 팀의 팀원만 쓸 수 있어요");
  if (!team.data.ai_enabled) throw new TeamAiError(409, "이 팀의 AI 도우미가 꺼져 있어요");

  let q = db
    .from("messages")
    .select("id,sender_id,content,created_at")
    .eq("team_id", teamId)
    .eq("message_type", "general")
    .is("visible_to", null) // 비공개 메시지는 읽지 않아요
    .order("created_at", { ascending: false })
    .limit(options.window ? 300 : 100);
  if (options.window) q = q.gte("created_at", options.window.startAt).lte("created_at", options.window.endAt);
  const [messages, profiles] = await Promise.all([q, db.from("profiles").select("id,nickname").in("id", ids)]);
  if (messages.error || profiles.error) throw new TeamAiError(503, "대화를 읽지 못했어요");

  const nameOf = (id: string) => profiles.data?.find((p) => p.id === id)?.nickname || "팀원";
  const kind = classifyRequest(text);
  if (!CARD_KINDS.includes(kind as CardKind)) {
    return {
      kind: "notice",
      title: "이 부탁은 아직 못 해요",
      basis: "대화 요약 · 할 일 정리 · 자료 정리 · 회의 잡기를 부탁할 수 있어요",
      items: [{ text: "@AI 대화 요약해줘" }, { text: "@AI 할 일 정리해줘" }, { text: "@AI 회의 잡아줘" }],
    };
  }
  const wanted = kind as CardKind;

  const today = seoulDate();
  const input: ExtractionInput = {
    teamId,
    timezone: "Asia/Seoul",
    referenceDate: today,
    // 요약 · 할 일에는 쓰지 않지만 B 입력 검사에 필요해요
    searchWindow: { startAt: `${today}T00:00:00+09:00`, endAt: `${seoulDate(Date.now() + 7 * 86400_000)}T00:00:00+09:00` },
    requiredMemberIds: ids,
    members: ids.map((id) => ({ memberId: id, name: nameOf(id), station: null })),
    messages: (messages.data ?? [])
      .filter((m) => m.sender_id && ids.includes(String(m.sender_id)))
      .reverse()
      .map((m) => ({ id: String(m.id), senderId: String(m.sender_id), text: String(m.content), sentAt: String(m.created_at) })),
  };

  const generate = (prompt: string) =>
    geminiGenerate(`${prompt}
[앱이 덧붙임]
- 이번 요청 종류는 "${wanted}"(${LABEL[wanted]})이다. 반드시 kind가 "${wanted}"인 카드 하나만 위 "${wanted}" 형식대로 출력한다. 다른 종류의 카드는 만들지 않는다.
- 대화에 없는 내용을 지어내지 않는다. 대화에 나오지 않은 할 일 · 마감 날짜를 만들지 않는다. 해당하는 내용이 없으면 items(회의록은 각 목록)를 빈 배열로 둔다.
- 사람을 말할 때는 팀원 목록의 이름을 쓴다. "사용자 1" 같은 이름을 만들지 않는다.
${options.memo ? `- 아래 '회의 메모'도 대화와 함께 읽는다.\n[회의 메모]\n${options.memo.slice(0, 6000)}\n` : ""}`);

  const result = await handleAiRequest(
    text,
    input,
    generate,
    { isEnabled: true, readScope: team.data.ai_read_scope === "mentioned_only" ? "MENTION_ONLY" : "ALL" },
    (tasks.data ?? []).map((t) => String(t.title)),
  );
  if (result.status !== "card") {
    return { kind: "notice", title: "AI가 정리하지 못했어요", basis: "잠시 뒤 다시 부탁해 주세요", items: [] };
  }
  const idOf = (name: string) => profiles.data?.find((p) => p.nickname && p.nickname.trim() === name.trim())?.id ?? null;
  return cardReply(result.card, nameOf, wanted, idOf);
}
