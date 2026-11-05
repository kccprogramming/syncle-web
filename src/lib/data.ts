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
import type { PlaceIntent } from "@/lib/place-intent";

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
  return members.find((m) => m.id === id) ?? { id, name: "?", initial: "?", color: "#F0F1F4", ink: "#3B414D" };
}
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
  return messages[confirmed ? `${teamId}-confirmed` : teamId] ?? [];
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

/**
 * 내 출발지 저장 — A (PATCH /api/me  { departureStation, departureLat, departureLng })
 * 2 새 팀 만들기, 2-1 팀 참여, 1-1 내 정보에서 출발지를 고르면 불러요.
 * 지금은 서버가 없어서 아무것도 하지 않고, 화면은 데모 상태(demo-store)에 기억해요.
 */
export async function saveMyOrigin(_memberId: string, _place: PlaceSearchResult): Promise<void> {
  // TODO: A 연결 시 fetch("/api/me", { method: "PATCH", body: JSON.stringify({ ... }) })
}

/** D에 보낼 출발지 글자: 역 이름이면 이름 그대로, 아니면 도로명 주소 (D resolveOrigin이 역/주소를 나눠서 찾아요) */
export function originForD(o: PlaceSearchResult): string {
  return /역(\s+\S+선)?$/.test(o.name) ? o.name : o.roadAddress;
}

/** 6 장소 후보 응답 (POST /api/places/recommend) */
export interface PlaceRecommendation {
  /** kakao = D가 실제로 찾은 결과, mock = 카카오 키가 없어서 가짜 데이터 */
  source: "kakao" | "mock";
  areaLabel: string;
  title: string;
  timeLabel: string;
  places: PlaceOption[];
  /** true면 시설·수용 인원을 확인하지 않은 후보예요 (D preview.venueConditions) */
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

/** GET /api/meetings — C (다가오는 회의 + 지난 회의) */
export function getMeetings(): Meeting[] {
  return meetings;
}
export function getMeeting(meetingId: string): Meeting {
  return meetings.find((m) => m.id === meetingId) ?? meetings[0];
}

/** GET /api/teams/:id/tasks — A (+ B가 찾은 할 일 후보) */
export function getTasks(teamId: string) {
  return tasks[teamId] ?? { tasks: [], aiSuggestion: null };
}

/** GET /api/teams/:id/files — A */
export function getFiles(teamId: string): TeamFile[] {
  return files[teamId] ?? [];
}

/** GET /api/notifications — A (앱 안 알림) */
export function getNotifications(): AppNotification[] {
  return notifications;
}

/** GET /api/meetings/:id/minutes — B */
export function getMinutes(meetingId: string): Minutes {
  return minutes[meetingId] ?? minutes["m-0"];
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
