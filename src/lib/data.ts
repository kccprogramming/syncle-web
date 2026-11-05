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
