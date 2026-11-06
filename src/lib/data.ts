/**
 * 화면에서 쓰는 데이터를 가져오는 곳.
 *
 * 지금은 src/mocks/*.json(가짜 데이터)을 바로 돌려줘요.
 * 백엔드 API가 준비되면 이 파일의 함수 안쪽만 fetch로 바꾸면 되고, 화면 코드는 그대로 둬요.
 * 각 함수 위의 주석에 연결할 API 주소를 적어 뒀어요 (기획서 '개발 역할 분담' 5장·9장).
 */
import type {
  AiReply,
  AppNotification,
  Condition,
  ConfirmRequest,
  Me,
  Meeting,
  Member,
  Message,
  Minutes,
  KakaoKeywordSearchResponse,
  KakaoPlaceDocument,
  NoMatchOption,
  PlaceSearchResult,
  PlaceOption,
  Proposal,
  Task,
  Team,
  TeamFile,
} from "@/types";

import meJson from "@/mocks/me.json";
import membersJson from "@/mocks/members.json";
import teamsJson from "@/mocks/teams.json";
import messagesJson from "@/mocks/messages.json";
import proposalsJson from "@/mocks/proposals.json";
import placesJson from "@/mocks/places.json";
import conditionsJson from "@/mocks/conditions.json";
import meetingsJson from "@/mocks/meetings.json";
import tasksJson from "@/mocks/tasks.json";
import filesJson from "@/mocks/files.json";
import notificationsJson from "@/mocks/notifications.json";
import minutesJson from "@/mocks/minutes.json";
import noMatchJson from "@/mocks/no-match.json";
import placeSearchJson from "@/mocks/place-search.json";
import aiRepliesJson from "@/mocks/ai-replies.json";
import memberOriginsJson from "@/mocks/member-origins.json";
import bConditionsJson from "@/mocks/b-conditions.json";
import type { PlaceIntent } from "@/lib/place-intent";
import { getSupabase } from "@/lib/supabase";
import { DEMO_NEIGHBORHOODS, demoMinutesShift, demoShiftText } from "@/lib/demo-scheduling";

/** 데모 팀(hci4 …)인지 — 진짜 팀 ID는 UUID예요. 데모는 DB를 건드리지 않고 화면에만 반영해요 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isDemoId = (id: string) => !UUID_RE.test(id);
const demoWait = (ms = 700) => new Promise((r) => setTimeout(r, ms));

const members = membersJson as Member[];
const teams = teamsJson as Team[];
const messages = messagesJson as Record<string, Message[]>;
const proposals = proposalsJson as Proposal[];
const places = placesJson as Record<string, { areaLabel: string; title: string; timeLabel: string; places: PlaceOption[] }>;
const conditions = conditionsJson as Record<string, Condition[]>;
const meetings = meetingsJson as Meeting[];
const tasks = tasksJson as Record<string, { tasks: Task[]; aiSuggestion: Task }>;
const files = filesJson as Record<string, TeamFile[]>;
const notifications = notificationsJson as AppNotification[];
const minutes = minutesJson as Record<string, Minutes>;
const noMatch = noMatchJson as Record<string, NoMatchOption[]>;
const placeSearch = placeSearchJson as KakaoKeywordSearchResponse;
const aiReplies = aiRepliesJson as Record<string, { summary: Omit<AiReply, "kind"> }>;

/** GET /api/me — A */
export function getMe(): Me {
  return meJson as Me;
}

/** 팀원 정보 (profiles) — A. 다른 팀원의 출발지는 동네까지만 받아요. */
export function getMember(id: string): Member {
  return liveMembers.get(id) ?? members.find((m) => m.id === id) ?? { id, name: "?", initial: "?", color: "#F0F1F4", ink: "#3B414D" };
}

/** 진짜 팀원 (A · profiles). 대화방을 열 때 채워 두면 getMember가 진짜 이름을 돌려줘요 */
const liveMembers = new Map<string, Member>();
export function getMembers(ids: string[]): Member[] {
  return ids.map(getMember);
}

/** GET /api/teams — A (내 팀 목록과 마지막 메시지) */
export function getTeams(): Team[] {
  return teams;
}

/** GET /api/teams/:id — A */
export function getTeam(teamId: string): Team {
  return teams.find((t) => t.id === teamId) ?? teams[0];
}

/* ───────── 실제 팀 (A · Supabase) ─────────
 * 로그인했으면 아래 함수로 진짜 팀을 읽고 만들어요. 로그인 안 했으면 위의 가짜 데이터(getTeams …)를 써요.
 */

/** 팀 배지 색 (가짜 데이터의 세 팀과 같은 색). 팀 ID로 하나를 골라서 늘 같은 색이 나와요 */
const TEAM_COLORS = [
  { color: "#DDE6F7", ink: "#23407A" },
  { color: "#F7E6D8", ink: "#7A3F12" },
  { color: "#E6F4EA", ink: "#2B6B3F" },
];
function teamColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TEAM_COLORS[h % TEAM_COLORS.length];
}

/** 실제 초대 코드인지 (A의 create_team이 만드는 32자리). 아니면 데모 코드(7K2Q-HCI4)예요 */
export function isLiveInviteCode(code: string): boolean {
  return /^[0-9a-f]{32}$/i.test(code.trim());
}

/** 초대 링크 주소 (0-2 화면) */
export function inviteUrl(code: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/invite/${code}`;
}

/**
 * 내 팀 목록 — A (Supabase teams · team_members · messages)
 * 로그인하지 않았거나 Supabase 키가 없으면 null (화면은 가짜 데이터를 써요).
 */
export async function loadMyTeams(): Promise<Team[] | null> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) return null;
  const mine = await supabase.from("team_members").select("team_id").eq("member_id", id);
  if (mine.error) throw new Error(mine.error.message);
  const ids = (mine.data ?? []).map((r) => String(r.team_id));
  if (ids.length === 0) return [];
  const [teamRows, memberRows] = await Promise.all([
    supabase.from("teams").select("id,name,invite_code,ai_enabled,ai_read_scope,created_at").in("id", ids),
    supabase.from("team_members").select("team_id,member_id,member_role").in("team_id", ids),
  ]);
  if (teamRows.error) throw new Error(teamRows.error.message);
  if (memberRows.error) throw new Error(memberRows.error.message);
  // 팀마다 마지막 메시지 한 줄 (팀 수가 적어서 팀마다 하나씩 물어봐요)
  const last = await Promise.all(
    ids.map((teamId) =>
      supabase.from("messages").select("content,message_type").eq("team_id", teamId).neq("message_type", "confirmation_question").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ),
  );
  const teams = (teamRows.data ?? []).map((t) => {
    const members = (memberRows.data ?? []).filter((m) => m.team_id === t.id);
    const created = String(t.created_at ?? "");
    const d = new Date(created);
    const msg = last[ids.indexOf(String(t.id))]?.data;
    const name = String(t.name);
    return {
      id: String(t.id),
      name,
      initial: Array.from(name.trim())[0] ?? "팀",
      ...teamColor(String(t.id)),
      memberIds: members.map((m) => String(m.member_id)),
      ownerId: String(members.find((m) => m.member_role === "owner")?.member_id ?? ""),
      aiEnabled: !!t.ai_enabled,
      aiScope: t.ai_read_scope === "mentioned_only" ? "mention" : "all",
      inviteCode: String(t.invite_code),
      createdAt: created.slice(0, 10),
      createdLabel: Number.isFinite(d.getTime()) ? `${String(d.getFullYear()).slice(2)}/${d.getMonth() + 1}/${d.getDate()}` : "",
      lastMessage: msg ? (msg.message_type === "general" ? String(msg.content) : "싱클 AI 알림이 있어요") : "아직 대화가 없어요 · 팀원을 초대해 보세요",
      unread: 0,
    } satisfies Team;
  });
  // 최근에 만든 팀이 위로
  return teams.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ───────── 팀 설정 (A) ─────────
 * 팀 이름 · AI 도우미 · AI가 읽는 범위는 방장만 바꿀 수 있어요 (A의 RLS).
 */

/** 팀 설정 바꾸기 — 방장이 아니면 "방장만 바꿀 수 있어요" */
export async function updateTeam(teamId: string, patch: { name?: string; aiEnabled?: boolean; aiScope?: "all" | "mention" }): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("로그인이 필요해요");
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error("팀 이름을 입력해 주세요");
    row.name = patch.name.trim();
  }
  if (patch.aiEnabled !== undefined) row.ai_enabled = patch.aiEnabled;
  if (patch.aiScope !== undefined) row.ai_read_scope = patch.aiScope === "mention" ? "mentioned_only" : "all_messages";
  // 권한이 없으면 오류 대신 0줄이 바뀌어서, 바뀐 줄을 돌려받아 확인해요
  const { data, error } = await supabase.from("teams").update(row).eq("id", teamId).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("방장만 바꿀 수 있어요");
}

/** 방장 넘기기 — A (transfer_team_owner) */
export async function transferTeamOwner(teamId: string, newOwnerId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("로그인이 필요해요");
  const { error } = await supabase.rpc("transfer_team_owner", { p_team_id: teamId, p_new_owner_id: newOwnerId });
  if (error) {
    const m = error.message;
    throw new Error(m.includes("OWNER_REQUIRED") ? "방장만 넘길 수 있어요" : m.includes("MUST_BE_MEMBER") ? "이 팀의 팀원에게만 넘길 수 있어요" : m);
  }
}

/**
 * 팀원 내보내기 — 방장만 (remove_team_member, supabase/a-remove-team-member.sql).
 * 정말 빠졌는지 확인한 뒤 대화방에 '○○님을 내보냈어요' 한 줄을 남겨요.
 */
export async function removeTeamMember(teamId: string, memberId: string, name: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("로그인이 필요해요");
  const { error } = await supabase.rpc("remove_team_member", { p_team_id: teamId, p_member_id: memberId });
  if (error) {
    const m = error.message;
    throw new Error(
      m.includes("OWNER_REQUIRED")
        ? "방장만 내보낼 수 있어요"
        : m.includes("CANNOT_REMOVE_SELF")
          ? "나는 내보낼 수 없어요 · 팀 나가기를 써 주세요"
          : m.includes("NOT_A_TEAM_MEMBER")
            ? "이미 팀에 없는 사람이에요"
            : m.includes("remove_team_member")
              ? "DB에 내보내기 기능이 아직 없어요 · supabase/a-remove-team-member.sql을 실행해 주세요"
              : m,
    );
  }
  const still = await supabase.from("team_members").select("member_id").eq("team_id", teamId).eq("member_id", memberId).maybeSingle();
  if (still.data) throw new Error("팀에서 빠지지 않았어요 · DB 권한을 확인해 주세요");
  const { id } = await signedIn();
  if (id) await supabase.from("messages").insert({ team_id: teamId, sender_id: id, message_type: "notice", content: `방장이 ${name}님을 팀에서 내보냈어요` });
}

/**
 * 팀 나가기 — A (leave_team)
 * 주의: 혼자 남은 방장이 나가면 A가 팀을 통째로 지워요 (대화 · 자료 · 할 일 모두). 화면에서 꼭 한 번 더 물어봐요.
 */
export async function leaveTeam(teamId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("로그인이 필요해요");
  const { error } = await supabase.rpc("leave_team", { p_team_id: teamId });
  if (error) throw new Error(error.message.includes("TRANSFER_OWNERSHIP_FIRST") ? "방장을 먼저 다른 팀원에게 넘겨 주세요" : error.message);
  // DB 권한 때문에 아무것도 안 지워져도 오류가 안 날 수 있어서, 정말 빠졌는지 확인해요
  const { id } = await signedIn();
  const still = await supabase.from("team_members").select("team_id").eq("team_id", teamId).eq("member_id", id ?? "").maybeSingle();
  if (still.data) throw new Error("팀에서 빠지지 않았어요 · DB의 leave_team 권한을 현서님께 확인해 주세요");
}

/* ───────── 진짜 대화방 (A · Supabase messages) ───────── */

/** "2026-11-06T13:05:00Z" → "22:05" (이 기기 시간) */
function hhmm(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type MessageRow = { id: string; sender_id: string | null; content: string; message_type: string; created_at: string; visible_to?: string[] | null };

/**
 * 대화방에 그리지 않는 메시지인지.
 * ① C 확인 질문(confirmation_question): B가 대화로 시간을 알 수 없던 팀원에게만 가서, 팀원마다 0장 · 1장으로
 *    달라 보였어요. 모두 같은 제안 카드('되는 시간 고르기')로 응답하니 대화방에서는 빼요 (11/6 밤 결정).
 * ② 다른 사람에게만 보내진 비공개 메시지: A 규칙(RLS)은 보낸 사람에게도 보여줘서 받는 사람에 내가 없으면 빼요.
 */
function notForMe(r: MessageRow, me: string | null | undefined): boolean {
  if (r.message_type === "confirmation_question") return true;
  return Array.isArray(r.visible_to) && r.visible_to.length > 0 && !!me && !r.visible_to.includes(me);
}

/** DB 메시지 한 줄 → 화면 메시지 */
export function toChatMessage(r: MessageRow): Message {
  const at = hhmm(r.created_at);
  if (r.message_type === "general" && r.sender_id) {
    const text = String(r.content);
    // 파일을 올리면 '📎 이름 · 크기' 메시지를 같이 남겨요 → 파일 말풍선으로
    const file = text.match(FILE_MESSAGE);
    if (file) return { id: r.id, type: "file", senderId: r.sender_id, fileName: file[1], size: file[2], at };
    return /(^|\s)@AI(\s|$)/i.test(text)
      ? { id: r.id, type: "mention-ai", senderId: r.sender_id, text: text.replace(/@AI\s*/i, "").trim(), at }
      : { id: r.id, type: "text", senderId: r.sender_id, text, at };
  }
  const ai = aiReplyCard(r, at);
  if (ai) return ai;
  return liveCard(r, at) ?? { id: r.id, type: "system", text: r.message_type === "confirmed" ? "회의가 확정됐어요" : String(r.content), at };
}

/** "2026-11-11T19:00:00+09:00" → "11/11(수) 19:00" (서울 시간) */
export function seoulLabel(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${"일월화수목금토"[d.getUTCDay()]}) ${d.toISOString().slice(11, 16)}`;
}

/** 저장된 AI 답 카드(notice · JSON) → 대화방 카드. 모양이 다르면 null */
function aiReplyCard(r: MessageRow, at: string): Message | null {
  if (r.message_type !== "notice") return null;
  let c: { type?: unknown; reply?: Partial<AiReply> };
  try {
    c = JSON.parse(String(r.content));
  } catch {
    return null;
  }
  const reply = c.reply;
  if (c.type !== "ai_reply" || !reply || typeof reply.title !== "string" || !Array.isArray(reply.items)) return null;
  return {
    id: r.id,
    type: "ai-reply",
    reply: { kind: reply.kind ?? "summary", title: reply.title, basis: String(reply.basis ?? ""), items: reply.items, link: reply.link },
    at,
    askedBy: r.sender_id ?? undefined,
  };
}

/** C가 남긴 메시지(JSON 글) → 대화방 카드. 모양이 다르면 null */
function liveCard(r: MessageRow, at: string): Message | null {
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(String(r.content));
  } catch {
    return null;
  }
  const proposalId = typeof c.proposalId === "string" ? c.proposalId : "";
  if (!proposalId) return null;
  if (r.message_type === "ai_proposal") {
    const deadline = typeof c.responseDeadline === "string" ? seoulLabel(c.responseDeadline) : "";
    return { id: r.id, type: "live-card", kind: "proposal", proposalId, title: String(c.title ?? "회의 제안"), sub: deadline ? `응답 마감 ${deadline} · 되는 시간을 골라 주세요` : "되는 시간을 골라 주세요", at };
  }
  if (r.message_type === "confirmed") {
    const m = (c.meeting ?? {}) as { startAt?: string; mode?: string; place?: { name?: string } | null };
    const where = m.mode === "online" ? "온라인" : (m.place?.name ?? "");
    return { id: r.id, type: "live-card", kind: "confirmed", proposalId, title: "회의가 확정됐어요", sub: [m.startAt ? seoulLabel(m.startAt) : "", where].filter(Boolean).join(" · "), at };
  }
  if (r.message_type === "confirmation_question") {
    return { id: r.id, type: "live-card", kind: "question", proposalId, title: String(c.question ?? "이 시간 괜찮으세요?"), sub: "나에게만 보이는 질문이에요 · 눌러서 응답해요", at };
  }
  return null;
}

/**
 * 제안을 만들었다고 대화방에 카드 남기기 — C가 만든 제안은 따로 공개 카드를 남기지 않아서 앱이 남겨요.
 * (A 규칙: 내가 보내는 메시지, confirmed가 아닌 종류는 남길 수 있어요)
 */
export async function postProposalCard(teamId: string, p: { proposalId: string; title: string; responseDeadline: string }): Promise<Message> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) throw new Error("로그인이 필요해요");
  const { data, error } = await supabase
    .from("messages")
    .insert({ team_id: teamId, sender_id: id, message_type: "ai_proposal", content: JSON.stringify({ type: "proposal_created", ...p }) })
    .select("id,sender_id,content,message_type,created_at")
    .single();
  if (error) throw new Error(error.message);
  return toChatMessage(data as MessageRow);
}

/**
 * '@AI 요약 · 할 일 · 자료 정리' 답 카드를 대화방에 남기기 — 팀원 모두에게 보여요 (실시간).
 * A 규칙상 사용자는 'notice' 메시지를 남길 수 있어요. B는 'general'만 읽어서 AI가 자기 카드를 다시 읽지 않아요.
 * 글 속 'https://'는 '\/'로 적어 A의 링크 자동 저장(팀 자료)에 다시 잡히지 않게 해요 (JSON으로 읽으면 같은 글).
 */
export async function postAiReplyCard(teamId: string, reply: AiReply): Promise<Message> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) throw new Error("로그인이 필요해요");
  const content = JSON.stringify({ type: "ai_reply", reply }).replace(/\//g, "\\/");
  const { data, error } = await supabase
    .from("messages")
    .insert({ team_id: teamId, sender_id: id, message_type: "notice", content })
    .select("id,sender_id,content,message_type,created_at")
    .single();
  if (error) throw new Error(error.message);
  return toChatMessage(data as MessageRow);
}

/** 홈 '다가오는 회의' 한 줄 (진짜 팀) */
export interface UpcomingItem {
  proposalId: string;
  teamName: string;
  title: string;
  /** confirmed: 확정된 회의 · collecting: 응답 받는 중인 제안 */
  kind: "confirmed" | "collecting";
  /** 확정 시각, 또는 지금 가장 유력한 후보 시각 (없으면 null) */
  startAt: string | null;
  placeName: string;
  responseDeadline: string;
  respondedCount: number;
  totalCount: number;
  /** 내가 아직 응답하지 않았는지 */
  needsMe: boolean;
}

/**
 * 홈 '다가오는 회의' — 내 팀들의 C 제안을 모아요 (C · c_schedule_list)
 * 끝나지 않은 확정 회의 + 아직 확정 전인 제안. 시간 순 (응답이 필요한 제안은 위로)
 */
export async function loadUpcoming(teams: Team[]): Promise<UpcomingItem[]> {
  const me = await myUserId();
  const now = Date.now();
  const lists = await Promise.all(teams.map((t) => loadTeamProposals(t.id).then((ps) => ps.map((p) => ({ t, p }))).catch(() => [])));
  const items: UpcomingItem[] = [];
  for (const { t, p } of lists.flat()) {
    if (p.status === "confirmed" && p.meeting) {
      if (Date.parse(p.meeting.endAt) <= now) continue; // 이미 끝난 회의
      items.push({
        proposalId: p.id,
        teamName: t.name,
        title: p.title,
        kind: "confirmed",
        startAt: p.meeting.startAt,
        placeName: p.meeting.mode === "online" ? "온라인" : (p.meeting.place?.name ?? ""),
        responseDeadline: p.responseDeadline,
        respondedCount: p.respondedCount,
        totalCount: p.totalCount,
        needsMe: false,
      });
    } else if (p.status !== "confirmed") {
      items.push({
        proposalId: p.id,
        teamName: t.name,
        title: p.title,
        kind: "collecting",
        startAt: p.candidates[0]?.startAt ?? null,
        placeName: "",
        responseDeadline: p.responseDeadline,
        respondedCount: p.respondedCount,
        totalCount: p.totalCount,
        needsMe: !!me && p.pendingIds.includes(me) && Date.parse(p.responseDeadline) > now,
      });
    }
  }
  const when = (i: UpcomingItem) => Date.parse(i.startAt ?? i.responseDeadline);
  return items.sort((a, b) => Number(b.needsMe) - Number(a.needsMe) || when(a) - when(b));
}

/** 팀의 진짜 회의 제안 목록 (C · c_schedule_list) — 팀 메뉴 · 홈에서 써요 */
export async function loadTeamProposals(teamId: string): Promise<{ id: string; title: string; status: "collecting" | "confirmed"; responseDeadline: string; meeting: { startAt: string; endAt: string; place: { name: string } | null; mode: string } | null; respondedCount: number; totalCount: number; pendingIds: string[]; candidates: { startAt: string; endAt: string }[] }[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return [];
  const res = await fetch(`/api/scheduling/teams/${teamId}`, { headers: { Authorization: `Bearer ${s.session.access_token}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error(body?.error?.message ?? "회의 목록을 불러오지 못했어요");
  return body.data;
}

/** 팀원 이름 불러와서 getMember가 쓰게 기억해요 (프로필은 같은 팀원끼리만 보여요) */
export async function loadTeamMembers(memberIds: string[]): Promise<Member[]> {
  // 데모 팀원(u-minji …)은 예시 데이터에 이미 있어요
  const liveIds = memberIds.filter((id) => !isDemoId(id));
  if (liveIds.length === 0) return getMembers(memberIds);
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("profiles").select("id,nickname").in("id", liveIds);
  if (error) throw new Error(error.message);
  const list = (data ?? []).map((p) => {
    const name = String(p.nickname || "팀원");
    return { id: String(p.id), name, initial: Array.from(name)[0] ?? "?", ...teamColor(String(p.id)) } satisfies Member;
  });
  list.forEach((m) => liveMembers.set(m.id, m));
  return list;
}

/**
 * 팀원 출발 동네 { 팀원 id: 동네 } — A (profiles.departure_neighborhood).
 * 팀원끼리는 동네까지만 보여요 (정확한 출발지는 서버만 읽어요). 아직 안 정했으면 빠져요.
 */
export async function loadMemberNeighborhoods(memberIds: string[]): Promise<Record<string, string>> {
  if (memberIds.length && memberIds.every(isDemoId)) return Object.fromEntries(memberIds.filter((id) => DEMO_NEIGHBORHOODS[id]).map((id) => [id, DEMO_NEIGHBORHOODS[id]]));
  const supabase = getSupabase();
  if (!supabase || memberIds.length === 0) return {};
  const { data, error } = await supabase.from("profiles").select("id,departure_neighborhood").in("id", memberIds);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const p of data ?? []) if (p.departure_neighborhood) out[String(p.id)] = String(p.departure_neighborhood);
  return out;
}

/** 대화 메시지 (오래된 것부터, 최근 200개) — A. 비공개 메시지는 받는 사람에게만 와요 (RLS) */
export async function loadTeamMessages(teamId: string): Promise<Message[]> {
  const { supabase, id: me } = await signedIn();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("id,sender_id,content,message_type,created_at,visible_to")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as MessageRow[] ?? [])
    .reverse()
    .filter((r) => !notForMe(r, me))
    .map((r) => toChatMessage(r));
}

/** 메시지 보내기 — A (messages insert, 보내는 사람 = 나) */
export async function sendTeamMessage(teamId: string, text: string): Promise<Message> {
  // 데모 팀: 저장하지 않고 보낸 것처럼만
  if (isDemoId(teamId)) return { id: `demo-${Date.now()}`, type: "text", senderId: getMe().id, text: text.trim(), at: hhmm(new Date().toISOString()) };
  const { supabase, id } = await signedIn();
  if (!supabase || !id) throw new Error("로그인이 필요해요");
  const { data, error } = await supabase
    .from("messages")
    .insert({ team_id: teamId, sender_id: id, content: text.trim(), message_type: "general" })
    .select("id,sender_id,content,message_type,created_at")
    .single();
  if (error) throw new Error(error.message);
  return toChatMessage(data as MessageRow);
}

/**
 * 새 메시지 실시간 받기 — A (Supabase Realtime). 끊을 때 부를 함수를 돌려줘요.
 * 내가 볼 수 없는 비공개 메시지는 Supabase가 보내지 않아요. 내가 보냈지만 다른 사람에게만 가는 메시지는 여기서 빼요.
 */
export function subscribeTeamMessages(teamId: string, onMessage: (m: Message, senderId: string | null) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  let me: string | null = null;
  void myUserId().then((id) => (me = id));
  const channel = supabase
    .channel(`team-messages:${teamId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `team_id=eq.${teamId}` }, (payload) => {
      const row = payload.new as MessageRow;
      if (notForMe(row, me)) return;
      onMessage(toChatMessage(row), row.sender_id);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/* ───────── 사진 · 파일 올리기 (A · Supabase Storage 'team-materials') ───────── */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // A와 같은 20MB 제한
const FILE_MESSAGE = /^📎 (.+) · (\d+(?:\.\d+)? ?(?:B|KB|MB))$/;

/** 1536 → "1.5KB" */
export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 사진 · 파일 올리기 — A
 * 1) 비공개 보관함 team-materials의 '팀ID/내ID/무작위이름.확장자'에 올리고
 * 2) 대화방에 '📎 이름 · 크기' 메시지를 남기고
 * 3) 팀 자료(team_materials)에 그 메시지와 이어서 저장해요. 중간에 실패하면 올린 파일을 지워요.
 * 파일 이름은 한글 등이 보관함 주소에 안 들어갈 수 있어서 주소는 무작위로, 원래 이름은 팀 자료에 남겨요.
 */
export async function uploadTeamFile(teamId: string, file: File): Promise<Message> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) throw new Error("로그인이 필요해요");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("20MB 이하 파일만 올릴 수 있어요");
  const ext = (file.name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] ?? "bin").toLowerCase();
  const path = `${teamId}/${id}/${crypto.randomUUID()}.${ext}`;
  const bucket = supabase.storage.from("team-materials");
  const up = await bucket.upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (up.error) throw new Error(`파일을 올리지 못했어요 · ${up.error.message}`);
  try {
    const name = file.name.replace(/\s+/g, " ").trim().slice(0, 120) || `파일.${ext}`;
    const message = await sendTeamMessage(teamId, `📎 ${name} · ${fileSizeLabel(file.size)}`);
    const row = await supabase
      .from("team_materials")
      .insert({ team_id: teamId, material_type: "file", name, file_path: path, source_message_id: message.id, added_by: id });
    if (row.error) throw new Error(row.error.message);
    return message;
  } catch (e) {
    await bucket.remove([path]);
    throw e instanceof Error ? e : new Error("팀 자료에 저장하지 못했어요");
  }
}

/** 사진 파일인지 (이름의 확장자로) */
export function isImageName(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(name);
}

/**
 * 사진 말풍선에 보여줄 주소를 한 번에 받아요 (팀원만, 1시간 동안 유효) — A
 * messageIds: 사진 파일 메시지들 → { 메시지 id: 주소 }
 */
export async function teamImageUrls(messageIds: string[]): Promise<Record<string, string>> {
  const supabase = getSupabase();
  if (!supabase || messageIds.length === 0) return {};
  const { data, error } = await supabase
    .from("team_materials")
    .select("source_message_id,file_path")
    .in("source_message_id", messageIds)
    .eq("material_type", "file");
  if (error || !data?.length) return {};
  const paths = data.map((r) => String(r.file_path));
  const signed = await supabase.storage.from("team-materials").createSignedUrls(paths, 3600);
  const byPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  const out: Record<string, string> = {};
  for (const r of data) {
    const url = byPath.get(String(r.file_path));
    if (url) out[String(r.source_message_id)] = url;
  }
  return out;
}

/** 파일 이름 → 자료 종류 표시 */
function extOf(name: string): TeamFile["ext"] {
  if (isImageName(name)) return "사진";
  if (/\.pptx?$|\.key$/i.test(name)) return "PPT";
  if (/\.pdf$/i.test(name)) return "PDF";
  return "파일";
}

/**
 * 팀 자료 (A · team_materials) — 대화방에 올린 사진 · 파일, 대화에서 나온 링크
 * 최근 것부터. 사진은 미리보기 주소(1시간)를 한 번에 받아 thumbUrl에 넣어요.
 */
export async function loadTeamMaterials(teamId: string): Promise<TeamFile[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("team_materials")
    .select("id,material_type,name,file_path,url,added_by,created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const photoPaths = rows.filter((r) => r.material_type === "file" && isImageName(String(r.name))).map((r) => String(r.file_path));
  const signed = photoPaths.length ? await supabase.storage.from("team-materials").createSignedUrls(photoPaths, 3600) : { data: [] };
  const thumbs = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => {
    const name = String(r.name);
    const d = new Date(String(r.created_at));
    const when = `${d.getMonth() + 1}/${d.getDate()}`;
    const who = r.added_by ? getMember(String(r.added_by)).name : "팀원";
    if (r.material_type === "link") {
      return { id: String(r.id), kind: "link", ext: "링크", name, meta: `${who} · ${when}`, url: String(r.url) } satisfies TeamFile;
    }
    const ext = extOf(name);
    return {
      id: String(r.id),
      kind: ext === "사진" ? "photo" : "file",
      ext,
      name,
      meta: `${who === "?" ? "팀원" : who} · ${when}`,
      filePath: String(r.file_path),
      thumbUrl: thumbs.get(String(r.file_path)) ?? undefined,
    } satisfies TeamFile;
  });
}

/* ───────── 팀 할 일 (A · team_tasks) ─────────
 * A의 /api/tasks와 같은 일을 같은 규칙(팀원만 · 만든 사람 = 나)으로 해요.
 */
export interface LiveTask {
  id: string;
  title: string;
  /** 맡은 사람. 없으면 null (팀 전체) */
  assigneeId: string | null;
  /** 마감 (ISO). 없으면 null */
  dueAt: string | null;
  done: boolean;
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
/** "2026-11-10T23:59:00+09:00" → "11/10(화)까지" */
export function dueLabel(dueAt: string | null): string {
  if (!dueAt) return "마감 없음";
  const d = new Date(dueAt);
  return Number.isFinite(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})까지` : "마감 없음";
}

/** 팀 할 일 — 안 끝난 것 먼저, 마감 빠른 순 */
export async function loadTeamTasks(teamId: string): Promise<LiveTask[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("team_tasks")
    .select("id,title,assigned_to,due_at,is_complete,created_at")
    .eq("team_id", teamId)
    .order("is_complete")
    .order("due_at", { nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    assigneeId: r.assigned_to ? String(r.assigned_to) : null,
    dueAt: r.due_at ? String(r.due_at) : null,
    done: !!r.is_complete,
  }));
}

/**
 * 할 일 만들기 — A. 다른 팀원에게 맡기면 그 사람에게 앱 안 알림을 보내요 (A와 같게).
 * due: 날짜 "2026-11-10" (그날 23:59 서울 시간까지). 비우면 마감 없음.
 */
export async function createTeamTask(teamId: string, input: { title: string; assigneeId: string | null; due: string | null }): Promise<LiveTask> {
  if (isDemoId(teamId)) return { id: `demo-task-${Date.now()}`, title: input.title.trim(), assigneeId: input.assigneeId, dueAt: input.due ? `${input.due}T23:59:00+09:00` : null, done: false };
  const { supabase, id } = await signedIn();
  if (!supabase || !id) throw new Error("로그인이 필요해요");
  const title = input.title.trim();
  if (!title) throw new Error("할 일을 입력해 주세요");
  const dueAt = input.due && /^\d{4}-\d{2}-\d{2}$/.test(input.due) ? `${input.due}T23:59:00+09:00` : null;
  const { data, error } = await supabase
    .from("team_tasks")
    .insert({ team_id: teamId, title, assigned_to: input.assigneeId, due_at: dueAt, created_by: id })
    .select("id,title,assigned_to,due_at,is_complete")
    .single();
  if (error) throw new Error(error.message);
  if (input.assigneeId && input.assigneeId !== id) {
    await supabase.rpc("create_team_notification", {
      p_team_id: teamId,
      p_recipient_id: input.assigneeId,
      p_type: "task_assigned",
      p_title: "새 할 일이 배정됐어요",
      p_body: title,
      p_reference_id: data.id,
    });
  }
  return { id: String(data.id), title: String(data.title), assigneeId: data.assigned_to ? String(data.assigned_to) : null, dueAt: data.due_at ? String(data.due_at) : null, done: !!data.is_complete };
}

/**
 * 진짜 팀 '@AI 요약 · 할 일 정리 · 자료 정리' — B 앱 카드 (POST /api/teams/{teamId}/ai).
 * 답 카드는 화면이 postAiReplyCard로 대화방에 남겨 팀원 모두 봐요. 할 일은 카드의 '추가'를 눌러야 저장돼요.
 */
export async function askTeamAi(teamId: string, text: string, extra: { memo?: string; window?: { startAt: string; endAt: string } } = {}): Promise<AiReply> {
  if (isDemoId(teamId)) return demoAiReply(teamId, text, extra.window);
  const supabase = getSupabase();
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) throw new Error("먼저 로그인해 주세요");
  const res = await fetch(`/api/teams/${teamId}/ai`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...extra }),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: AiReply; error?: { message?: string } } | null;
  if (!res.ok || !body?.ok || !body.data) throw new Error(body?.error?.message ?? "AI가 정리하지 못했어요");
  return body.data;
}

/** 데모 팀의 AI 답: 회의록은 예시 회의록, 나머지는 예시 답 카드 (Gemini를 부르지 않아요) */
async function demoAiReply(teamId: string, text: string, window?: { startAt: string; endAt: string }): Promise<AiReply> {
  await demoWait();
  if (!/회의록/.test(text)) return getAiReply(teamId, text);
  // 지난 '주제 선정 회의'(m-0)면 그 회의록, 이번 '역할 분담' 회의면 m-1 회의록 (날짜는 회의 날짜 기준)
  const past = !window || Date.parse(window.endAt) < Date.now() - 3 * 86_400_000;
  const m = past ? getMinutes("m-0") : getMinutes("m-1", demoMinutesShift(window.startAt));
  const byName = (meta: string) => members.find((x) => meta.startsWith(x.name))?.id ?? null;
  return {
    kind: "minutes",
    title: "회의록",
    basis: "회의 메모와 회의 시간 대화를 근거로 정리했어요 · 데모 예시",
    items: [
      ...m.summary.map((t) => ({ text: t })),
      ...m.decided.map((d) => ({ text: d.text, tag: d.settled ? "정함" : "미정" })),
      ...m.tasks.map((t) => ({ text: t.title, sub: t.meta, tag: "할 일", assigneeId: byName(t.meta), due: null })),
    ],
  };
}

/** 할 일 완료 체크 — A */
export async function setTaskDone(taskId: string, done: boolean): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("team_tasks")
    .update({ is_complete: done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
}

/** 팀 자료 하나 열기 → 1시간 동안 열 수 있는 주소 (링크 자료면 그 주소) */
export async function materialUrl(f: TeamFile): Promise<string | null> {
  if (f.url) return f.url;
  if (f.thumbUrl) return f.thumbUrl;
  const supabase = getSupabase();
  if (!supabase || !f.filePath) return null;
  const signed = await supabase.storage.from("team-materials").createSignedUrl(f.filePath, 3600);
  return signed.data?.signedUrl ?? null;
}

/** 대화방 파일 말풍선 → 1시간 동안 열 수 있는 주소 (팀원만). 팀 자료에 없으면 null */
export async function teamFileUrl(messageId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from("team_materials").select("file_path").eq("source_message_id", messageId).eq("material_type", "file").maybeSingle();
  if (!data?.file_path) return null;
  const signed = await supabase.storage.from("team-materials").createSignedUrl(String(data.file_path), 3600);
  return signed.data?.signedUrl ?? null;
}

/* ───────── 앱 안 알림 (A · app_notifications) ───────── */

type NotificationRow = { id: string; team_id: string; notification_type: string; title: string; body: string; reference_id: string | null; is_read: boolean; created_at: string; teams: { name: string } | null };

/** DB 알림 한 줄 → 화면 알림 (종류마다 누르면 갈 곳을 정해요) */
function toNotification(r: NotificationRow): AppNotification {
  const d = new Date(r.created_at);
  const today = new Date().toDateString() === d.toDateString();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const kind: AppNotification["kind"] = r.notification_type === "task_assigned" ? "task" : r.notification_type === "meeting_response" ? "due" : "ai";
  const href =
    r.notification_type === "task_assigned"
      ? `/teams/${r.team_id}/all?tab=tasks`
      : r.notification_type === "meeting_response" && r.reference_id
        ? `/proposals/${r.reference_id}`
        : `/teams/${r.team_id}`;
  return {
    id: r.id,
    kind,
    teamName: r.teams?.name ?? "팀",
    time: today ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`,
    text: r.body ? `${r.title} · ${r.body}` : r.title,
    href,
    unread: !r.is_read,
    group: today ? "today" : "before",
  };
}

/** 내 알림 (최근 100개) — 로그인 안 했으면 null (화면은 가짜 데이터) */
export async function loadMyNotifications(): Promise<AppNotification[] | null> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) return null;
  const { data, error } = await supabase
    .from("app_notifications")
    .select("id,team_id,notification_type,title,body,reference_id,is_read,created_at,teams(name)")
    .eq("recipient_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toNotification(r as unknown as NotificationRow));
}

/** 안 읽은 알림 수 (홈 🔔) — 로그인 안 했으면 null */
export async function countUnreadNotifications(): Promise<number | null> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) return null;
  const { count, error } = await supabase.from("app_notifications").select("id", { count: "exact", head: true }).eq("recipient_id", id).eq("is_read", false);
  if (error) return 0;
  return count ?? 0;
}

/** 알림 읽음 처리 — id가 없으면 모두 (A의 PATCH /api/notifications와 같게) */
export async function markNotificationsRead(notificationId?: string): Promise<void> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) return;
  let q = supabase.from("app_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("recipient_id", id).eq("is_read", false);
  if (notificationId) q = q.eq("id", notificationId);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

/** 새 알림 실시간 받기 (Supabase Realtime) — 끊을 함수를 돌려줘요 */
export function subscribeMyNotifications(userId: string, onNew: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`my-notifications:${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "app_notifications", filter: `recipient_id=eq.${userId}` }, () => onNew())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** 지금 로그인한 내 id (A) */
export async function myUserId(): Promise<string | null> {
  return (await signedIn()).id ?? null;
}

/** 팀 하나 — A. 내가 속한 팀이 아니거나 로그인 안 했으면 null */
export async function loadTeam(teamId: string): Promise<Team | null> {
  if (isDemoId(teamId)) return teams.find((t) => t.id === teamId) ?? null;
  return (await loadMyTeams())?.find((t) => t.id === teamId) ?? null;
}

/**
 * 새 팀 만들기 — A (create_team). 만든 사람이 방장이 돼요.
 * aiEnabled=false면 만든 뒤 AI 도우미를 꺼요. 초대 코드를 같이 돌려줘요.
 */
export async function createTeam(name: string, aiEnabled: boolean): Promise<{ teamId: string; inviteCode: string }> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) throw new Error("로그인이 필요해요");
  const { data, error } = await supabase.rpc("create_team", { p_name: name.trim() });
  if (error) throw new Error(error.message.includes("TEAM_NAME_REQUIRED") ? "팀 이름을 입력해 주세요" : error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { team_id: string; invite_code: string } | undefined;
  if (!row) throw new Error("팀을 만들지 못했어요");
  if (!aiEnabled) await supabase.from("teams").update({ ai_enabled: false }).eq("id", row.team_id);
  return { teamId: row.team_id, inviteCode: row.invite_code };
}

/** 초대 미리보기 — A (preview_team_invite, 로그인 전에도 돼요). 없는 코드면 null */
export async function previewInvite(code: string): Promise<{ teamId: string; teamName: string; inviterName: string; memberCount: number } | null> {
  const supabase = getSupabase();
  if (!supabase || !isLiveInviteCode(code)) return null;
  const { data, error } = await supabase.rpc("preview_team_invite", { p_invite_code: code.trim() });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { team_id: string; team_name: string; inviter_name: string; member_count: number } | undefined;
  return row ? { teamId: row.team_id, teamName: row.team_name, inviterName: row.inviter_name, memberCount: Number(row.member_count) } : null;
}

/** 초대 코드로 팀 참여 — A (join_team). 이미 팀원이면 그대로 들어가요. 팀 ID를 돌려줘요 */
export async function joinTeam(code: string): Promise<string> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) throw new Error("로그인이 필요해요");
  const { data, error } = await supabase.rpc("join_team", { p_invite_code: code.trim() });
  if (error) throw new Error(error.message.includes("INVALID_INVITE_CODE") ? "초대 코드를 다시 확인해 주세요" : error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { team_id: string } | string | undefined;
  const teamId = typeof row === "string" ? row : row?.team_id;
  if (!teamId) throw new Error("팀에 참여하지 못했어요");
  return teamId;
}

/** 내 이름 바꾸기 — A (profiles.nickname). 팀원에게 보이는 이름이에요 */
export async function saveMyNickname(nickname: string): Promise<void> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id || !nickname.trim()) return;
  const { error } = await supabase.from("profiles").update({ nickname: nickname.trim(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** GET /api/invites/:code — A (로그인 전에도 볼 수 있는 초대 미리보기) */
export function getInvite(code: string) {
  const team = teams.find((t) => t.inviteCode === code) ?? teams[0];
  return {
    code: team.inviteCode,
    team,
    inviterName: getMember(team.ownerId).name,
    memberNames: ["민지", "지우", "민수"],
  };
}

/** 대화 메시지 (Supabase 실시간 구독) — A. confirmed=true면 확정 뒤 대화를 돌려줘요. */
export function getMessages(teamId: string, confirmed = false): Message[] {
  // 예시 대화 속 날짜("11/11(수) 저녁 7시 이후")는 오늘 기준으로 옮겨요 → 데모 제안의 시간 후보와 같은 날이 돼요
  return (messages[confirmed ? `${teamId}-confirmed` : teamId] ?? []).map((m) => ("text" in m && typeof m.text === "string" ? { ...m, text: demoShiftText(m.text) } : m));
}

/** GET /api/proposals/:id — C */
export function getProposal(proposalId: string): Proposal {
  return proposals.find((p) => p.id === proposalId) ?? proposals[0];
}

/** GET /api/proposals/:id/places — D */
export function getPlaces(proposalId: string) {
  return places[proposalId] ?? places["p-1"];
}

/**
 * 팀원 출발지 (서버에서만 써요) — A (profiles.departure_station)
 * 다른 팀원의 정확한 출발지는 화면에 보내지 않고, D 장소 추천에만 써요.
 */
export function getMemberOrigin(memberId: string): string | undefined {
  return (memberOriginsJson as Record<string, string>)[memberId];
}

/** 로그인한 내 프로필 (A · Supabase profiles + profile_private_locations) */
export interface MyProfile {
  nickname: string;
  /** 정확한 출발지 (나만 봄). D에 넘기는 글자 그대로: 역 이름 또는 도로명 주소 */
  origin: string | null;
  /** 팀원에게 보이는 동네 */
  area: string | null;
  /** 매주 안 되는 시간 — A는 한 줄 글로 저장해요 ("화·목 14:00–18:00 수업") */
  weekly: string[];
  notificationsOn: boolean;
}

/**
 * 내 프로필 불러오기 — A (Supabase). 로그인하지 않았거나 Supabase 키가 없으면 null (화면은 데모 값을 써요).
 */
export async function loadMyProfile(): Promise<MyProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  const id = auth.user?.id;
  if (!id) return null;
  const [profile, loc] = await Promise.all([
    supabase.from("profiles").select("nickname,departure_neighborhood,weekly_unavailable,notifications_enabled").eq("id", id).maybeSingle(),
    supabase.from("profile_private_locations").select("departure_origin").eq("user_id", id).maybeSingle(),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  const p = profile.data;
  return {
    nickname: p?.nickname ?? "",
    origin: loc.data?.departure_origin ?? null,
    area: p?.departure_neighborhood ?? null,
    weekly: Array.isArray(p?.weekly_unavailable) ? (p.weekly_unavailable as unknown[]).filter((x): x is string => typeof x === "string") : [],
    notificationsOn: p?.notifications_enabled ?? true,
  };
}

/**
 * 내 출발지 저장 — A (Supabase)
 * 정확한 출발지는 나만 보는 profile_private_locations에, 동네는 팀원이 보는 profiles에 저장해요.
 * 2 새 팀 만들기, 2-1 팀 참여, 1-1 내 정보에서 출발지를 고르면 불러요. 로그인 안 했으면 아무것도 하지 않아요 (데모).
 */
export async function saveMyOrigin(_memberId: string, place: PlaceSearchResult): Promise<void> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) return;
  const now = new Date().toISOString();
  const [a, b] = await Promise.all([
    supabase.from("profile_private_locations").upsert({ user_id: id, departure_origin: originForD(place), updated_at: now }),
    supabase.from("profiles").update({ departure_neighborhood: place.area || null, updated_at: now }).eq("id", id),
  ]);
  if (a.error || b.error) throw new Error((a.error ?? b.error)!.message);
}

/** 매주 안 되는 시간 저장 — A (Supabase profiles.weekly_unavailable). 로그인 안 했으면 아무것도 하지 않아요 */
export async function saveMyWeekly(lines: string[]): Promise<void> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) return;
  const { error } = await supabase.from("profiles").update({ weekly_unavailable: lines, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** 알림 켜기/끄기 저장 — A (Supabase profiles.notifications_enabled) */
export async function saveMyNotifications(on: boolean): Promise<void> {
  const { supabase, id } = await signedIn();
  if (!supabase || !id) return;
  const { error } = await supabase.from("profiles").update({ notifications_enabled: on }).eq("id", id);
  if (error) throw new Error(error.message);
}

async function signedIn() {
  const supabase = getSupabase();
  const id = supabase ? (await supabase.auth.getUser()).data.user?.id : undefined;
  return { supabase, id };
}

/** D에 보낼 출발지 글자: 역 이름이면 이름 그대로, 아니면 도로명 주소 (D resolveOrigin이 역/주소를 나눠서 찾아요) */
export function originForD(o: PlaceSearchResult): string {
  if (/역(\s+\S+선)?$/.test(o.name)) return o.name;
  // 번지(숫자)까지 있는 주소를 먼저 써요. '서울 구로구 구로동'처럼 동네까지만 있으면 D가 위치를 정할 수 없어요
  const exact = (a: string) => /\d+(-\d+)?$/.test(a.trim());
  if (exact(o.roadAddress)) return o.roadAddress;
  if (exact(o.address)) return o.address;
  return o.roadAddress || o.address;
}

/** 이 출발지로 이동시간을 계산할 수 있는지 (D가 위치를 정확히 찾는지) — /api/places/check-origin */
export async function checkOrigin(o: PlaceSearchResult): Promise<boolean> {
  try {
    const res = await fetch(`/api/places/check-origin?q=${encodeURIComponent(originForD(o))}`);
    const body = (await res.json()) as { ok?: boolean };
    return body.ok !== false;
  } catch {
    return true; // 확인이 안 되면 막지 않아요
  }
}

/**
 * 예시 회의 조건 (서버에서만 써요) — GEMINI_API_KEY가 없을 때 B 대신 C에 넘겨요.
 * B가 이 팀 대화에서 뽑았을 법한 조건이라, C의 시간 계산은 실제로 돌아가요.
 * 반환 모양은 B의 Conditions (src/server/b/b-c-contract.ts)예요.
 */
export function getDemoConditions(teamId: string): unknown | null {
  return (bConditionsJson as Record<string, unknown>)[teamId] ?? null;
}

/** 6 장소 후보의 지역 하나 (기준 역 + 그 주변 장소) */
export interface AreaView {
  /** 지역 이름 = 기준 역 (예: 종로3가역) */
  name: string;
  /** 지역 순위 (1부터). 추천할 장소가 없으면 null */
  rank: number | null;
  /** 이 지역을 이 순위로 둔 이유 */
  reason: string;
  places: PlaceOption[];
  /** 이동시간 제한을 넘어서 뺀 장소 수 */
  excludedCount: number;
}

/** 6 장소 후보 응답 (POST /api/places/recommend) */
export interface PlaceRecommendation {
  /** kakao = 실제로 찾은 결과, mock = 카카오 키가 없어서 가짜 데이터 */
  source: "kakao" | "mock";
  timeLabel: string;
  /** 추천 지역 (순위 순서). 지역마다 장소 몇 곳 */
  areas: AreaView[];
  /** 출발지를 확인하지 못한 팀원 이름 */
  unknownOrigins: string[];
  /** 추천 기준 설명 */
  rule: string;
  /** true면 시설·수용 인원을 확인하지 않은 후보예요 */
  unverified: boolean;
}

/**
 * 장소 후보 추천 — D (POST /api/places/recommend)
 * 서버가 D의 findPlaces로 장소를 찾고 팀원별 대중교통 시간을 계산해요.
 * keyword: 찾을 장소 종류 (스터디룸, 합주실 …)
 * origins: 팀원이 직접 정한 출발지 { memberId: 역 이름 또는 도로명 주소 }.
 *   데모에서는 이 브라우저에서 정한 값을 같이 보내요. 백엔드를 붙이면 서버가 각자의 프로필(A)에서 읽어요.
 */
export async function recommendPlaces(
  proposalId: string,
  opts: { keyword: string; origins: Record<string, string> },
  signal?: AbortSignal,
): Promise<PlaceRecommendation> {
  const res = await fetch("/api/places/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposalId, keyword: opts.keyword, origins: opts.origins }),
    signal,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(body?.error?.message ?? `장소 추천 실패 (${res.status})`);
  return body as PlaceRecommendation;
}

/** GET /api/conditions?proposal=:id — B */
export function getConditions(proposalId: string): Condition[] {
  return conditions[proposalId] ?? [];
}

/**
 * 회의 확정 — 예시 제안(p-1 …)용. 아무것도 저장하지 않고 화면은 데모 상태(demo-store)에 기억해요.
 * 실제 제안(UUID)은 C 화면(src/components/scheduling/LiveProposal.tsx)이
 * POST /api/scheduling/proposals/{id}/confirm { candidateId, placeId, allowPartial, version }로 바로 확정해요.
 * (C는 timeCandidateId · acknowledgePartialAttendance 이름도 받아요. 장소 ID는 C 장소 API 결과여야 해요.)
 */
export function confirmProposal(_req: ConfirmRequest): void {
  // 서버가 생기면: await fetch(`/api/proposals/${_req.proposalId}/confirm`, { method: "POST", body: JSON.stringify(_req) })
}

/** GET /api/meetings — C (다가오는 회의 + 지난 회의) */
export function getMeetings(): Meeting[] {
  return meetings;
}
export function getMeeting(meetingId: string): Meeting {
  return meetings.find((m) => m.id === meetingId) ?? meetings[0];
}

/** GET /api/teams/:id/tasks — A (+ B가 찾은 할 일 후보) */
export function getTasks(teamId: string) {
  const t = tasks[teamId] ?? { tasks: [], aiSuggestion: null };
  // 예시 날짜는 오늘 기준으로 옮겨요 (발표 날짜가 언제여도 '이번 주 할 일'로 보이게)
  return { tasks: t.tasks.map((x) => ({ ...x, due: demoShiftText(x.due) })), aiSuggestion: t.aiSuggestion && { ...t.aiSuggestion, due: demoShiftText(t.aiSuggestion.due) } };
}

/** GET /api/teams/:id/files — A */
export function getFiles(teamId: string): TeamFile[] {
  return (files[teamId] ?? []).map((f) => ({ ...f, meta: demoShiftText(f.meta) }));
}

/** GET /api/notifications — A (앱 안 알림) */
export function getNotifications(): AppNotification[] {
  return notifications;
}

/** GET /api/meetings/:id/minutes — B */
export function getMinutes(meetingId: string, days?: number): Minutes {
  const m = minutes[meetingId] ?? minutes["m-0"];
  const sh = (t: string) => demoShiftText(t, days);
  return { ...m, meta: sh(m.meta), summary: m.summary.map(sh), decided: m.decided.map((d) => ({ ...d, text: sh(d.text) })), tasks: m.tasks.map((t) => ({ ...t, meta: sh(t.meta) })) };
}

/** GET /api/proposals/:id/alternatives — C (모두 되는 시간이 없을 때) */
export function getNoMatchOptions(proposalId: string): NoMatchOption[] {
  return noMatch[proposalId] ?? noMatch["p-1"];
}

/** '@AI 회의 잡아줘' 응답 (POST /api/ai/request) */
export interface AiRequestResponse {
  /** gemini = B가 실제 AI로 대화를 읽은 결과, mock = GEMINI_API_KEY가 없어서 예시 흐름 */
  source: "gemini" | "mock";
  /** B 결과의 상태 (ready · needs_confirmation · not_supported · clarify_request · ignored) */
  status?: string;
  /** 대화방에 보여줄 답 카드 (source가 gemini일 때) */
  reply?: AiReply;
  /** true면 회의 조건이 정리돼서 C(시간 후보)로 넘길 수 있어요 */
  canPropose?: boolean;
  /** AI가 대화를 보고 고른 장소 종류와 근거 (6 장소 후보가 이걸로 찾아요) */
  placeIntent?: PlaceIntent;
  /** C가 시간 후보를 계산해서 만든 회의 제안 (대화방 카드 · 5 · 6 · 7이 이걸 보여줘요) */
  proposal?: Proposal;
  /** C가 남긴 경고 */
  warnings?: string[];
}

/**
 * 회의 잡기 부탁 — B (POST /api/ai/request)
 * 서버가 이 팀의 대화와 화면에서 새로 보낸 메시지를 B의 handleAiRequest에 넘겨요.
 * extraMessages: 이 화면에서 방금 보낸 메시지들 (아직 서버에 저장 전이라 같이 보내요)
 */
export async function requestAi(teamId: string, text: string, extraMessages: Message[], signal?: AbortSignal): Promise<AiRequestResponse> {
  const res = await fetch("/api/ai/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId, text, extraMessages }),
    signal,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(body?.error?.message ?? `AI 요청 실패 (${res.status})`);
  return body as AiRequestResponse;
}

/**
 * '@AI 부탁'에 대한 AI 답 — B (POST /api/teams/:id/ai, 본문 { text })
 * 회의 잡기는 회의 제안(getProposal)으로 따로 가고, 나머지 부탁은 여기서 답해요.
 * 지금은 부탁 글에 들어간 낱말로 종류를 고르고, 이미 있는 가짜 데이터(할 일·자료·회의록)로 답을 만들어요.
 * 백엔드를 붙이면 AI가 종류를 고르고 답을 만들어 이 모양(AiReply)으로 돌려주면 돼요.
 */
export function getAiReply(teamId: string, text: string): AiReply {
  const t = text.replace(/\s+/g, "");

  if (/할일|할것|todo/i.test(t)) {
    const { tasks: list, aiSuggestion } = getTasks(teamId);
    const open = list.filter((x) => !x.done);
    const items: AiReply["items"] = open.map((x) => ({ text: x.title, sub: `${getMember(x.assigneeId).name} · ${x.due}` }));
    if (aiSuggestion) items.push({ text: aiSuggestion.title, sub: `${getMember(aiSuggestion.assigneeId).name} · 대화에서 찾았어요`, tag: "새로 찾음" });
    return {
      kind: "tasks",
      title: `남은 할 일 ${open.length}개`,
      basis: `팀 할 일 ${list.length}개와 오늘 대화를 확인했어요`,
      items,
      link: { label: "할 일 전체 보기", href: `/teams/${teamId}/all?tab=tasks` },
    };
  }

  if (/자료|파일|링크/.test(t)) {
    const list = getFiles(teamId);
    return {
      kind: "files",
      title: `공유된 자료 ${list.length}개`,
      basis: "이 대화방에 올라온 파일·링크·사진을 모았어요",
      items: list.slice(0, 4).map((f) => ({ text: f.name, sub: f.meta, tag: f.isNew ? "새 자료" : undefined })),
      link: { label: "자료 전체 보기", href: `/teams/${teamId}/all?tab=files` },
    };
  }

  if (/회의록/.test(t)) {
    const m = getMinutes("m-0");
    return {
      kind: "minutes",
      title: `${m.title} 회의록`,
      basis: m.meta,
      items: m.summary.map((line) => ({ text: line })),
      link: { label: "회의록 전체 보기", href: `/meetings/${m.meetingId}/minutes` },
    };
  }

  if (/요약|정리|무슨얘기/.test(t)) {
    const mock = aiReplies[teamId]?.summary;
    if (mock) return { kind: "summary", ...mock };
    // 가짜 요약이 없는 팀은 최근 글 메시지를 그대로 보여줘요
    const recent = getMessages(teamId).filter((x) => x.type === "text").slice(-4);
    return {
      kind: "summary",
      title: "오늘 대화 요약",
      basis: `최근 메시지 ${recent.length}개를 읽었어요`,
      items: recent.map((x) => ({ text: x.type === "text" ? x.text : "", sub: x.type === "text" ? getMember(x.senderId).name : undefined })),
    };
  }

  return {
    kind: "help",
    title: "이런 부탁을 도와드릴 수 있어요",
    basis: "부탁을 정확히 알아듣지 못했어요. 아래처럼 말해 주세요",
    items: [
      { text: "@AI 회의 잡아줘" },
      { text: "@AI 오늘 대화 요약해줘" },
      { text: "@AI 할 일 정리해줘" },
      { text: "@AI 공유된 자료 모아줘" },
    ],
  };
}

/**
 * 출발지 장소 검색 — A (카카오 로컬 API)
 * 화면은 이 함수만 불러요. 우리 서버 /api/places/search 가 카카오 로컬 API를 대신 불러 줘요
 * (카카오 REST 키가 브라우저에 보이지 않게 하려고 서버를 거쳐요. src/app/api/places/search/route.ts).
 * .env.local에 KAKAO_REST_API_KEY가 없으면 서버가 아래 searchMockPlaces(가짜 데이터)로 대신 찾아요.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`/api/places/search?query=${encodeURIComponent(query.trim())}`, { signal });
  if (!res.ok) throw new Error(`장소 검색 실패 (${res.status})`);
  const body = (await res.json()) as { results: PlaceSearchResult[] };
  return body.results;
}

/**
 * 가짜 장소 검색 (src/mocks/place-search.json, 카카오 '키워드로 장소 검색' 응답과 같은 모양).
 * 카카오 키가 없을 때 서버가 쓰고, 처음 출발지(getMyOrigin)를 정할 때도 써요.
 */
export function searchMockPlaces(query: string): PlaceSearchResult[] {
  // 띄어쓰기로 나눈 낱말이 모두 이름·도로명·지번 주소 어딘가에 있으면 찾아요
  // 예: "국민대", "정릉로", "정릉로 77", "성북구 국민", "중앙로 1569"(실제 주소는 '중앙로 지하 1569')
  const words = query.trim().split(/\s+/).filter(Boolean).map(norm);
  if (words.length === 0) return [];
  const whole = norm(query);

  return placeSearch.documents
    .map((d) => {
      const name = norm(d.place_name);
      const hay = name + norm(d.road_address_name) + norm(d.address_name);
      if (!words.every((w) => hay.includes(w)) && !hay.includes(whole)) return null;
      // 이름이 검색어로 시작 > 이름에 들어감 > 주소에만 들어감 순서로 보여줘요
      const rank = name.startsWith(whole) ? 0 : name.includes(words[0]) ? 1 : 2;
      return { d, rank };
    })
    .filter((x): x is { d: KakaoPlaceDocument; rank: number } => x !== null)
    .sort((a, b) => a.rank - b.rank)
    .map((x) => kakaoToSearchResult(x.d));
}

/** 검색 비교용: 띄어쓰기와 도로명 주소의 '지하'를 빼고 비교해요 */
function norm(s: string) {
  return s.replace(/\s+/g, "").replace(/지하(?=\d)/g, "");
}

/**
 * 내 출발지 (GET /api/me의 출발지) — A
 * 연결할 때: 서버가 저장해 둔 출발지(이름·도로명 주소·lat·lng)를 PlaceSearchResult 모양으로 돌려줘요.
 * 지금은 me.json의 origin 이름 "대화역 (일산)"에서 괄호를 뺀 이름으로 가짜 검색 결과를 찾아요.
 */
export function getMyOrigin(): PlaceSearchResult | null {
  return searchMockPlaces(getMe().origin.replace(/\(.*\)/, "").trim())[0] ?? null;
}

/** 카카오 응답의 장소 한 개 → 화면에서 쓰는 모양 (x=경도, y=위도 문자열을 숫자로) */
export function kakaoToSearchResult(d: KakaoPlaceDocument): PlaceSearchResult {
  // 지번 주소 "경기 고양시 일산서구 대화동 2172"에서 '동' 이름만 팀원에게 보여요
  // ("정릉동", "명륜3가", "안암동5가"처럼 한글로 시작해 동·가·읍·면으로 끝나는 낱말, 없으면 구 이름)
  const parts = d.address_name.split(" ");
  const area = parts.find((w) => /^[가-힣][가-힣0-9]*[동가읍면]$/.test(w)) ?? parts[1] ?? "";
  return {
    id: d.id,
    name: d.place_name,
    roadAddress: d.road_address_name || d.address_name,
    address: d.address_name,
    lat: Number(d.y),
    lng: Number(d.x),
    area,
  };
}
