/**
 * 로그인 없이 보는 데모(예시 팀 'HCI 팀프로젝트 4조')용 가짜 일정 서버.
 *
 * 데모도 실제 화면(LiveProposal · LiveMeeting · LiveMinutes · LiveConditions)을 그대로 쓰도록,
 * 데모 제안 ID(p-1 · m-1 · m-0)로 오는 C 일정 API 요청을 서버 대신 여기서 처리해요.
 * - 계산은 실제와 같은 코드: 시간 후보(projectProposal), 장소 순위(combineRegionPlaces)
 * - 저장은 이 브라우저 탭에만 (sessionStorage) — 데모에서 누른 내용은 DB에 남지 않아요
 * - 날짜는 오늘 기준으로 만들어요 (발표 날짜가 언제여도 '다음 주 회의'로 보이게)
 */
import { projectProposal, type PlaceResult, type SavedResponse, type StoredProposal } from "@/features/scheduling/proposals";
import { combineRegionPlaces, type RegionSearch } from "@/features/scheduling/region-places";
import type { Conditions, Slot } from "@/server/b/b-c-contract";
import placesJson from "@/mocks/places.json";

/** 데모 제안: p-1 응답 받는 중 · m-1 확정된 회의 · m-0 지난 회의(회의록) */
const DEMO_IDS = ["p-1", "m-1", "m-0"] as const;
export const isDemoProposalId = (id: string) => (DEMO_IDS as readonly string[]).includes(id);

const TEAM = "hci4";
const ME = "u-minji"; // 데모에서 보는 사람 = 방장 민지 (모든 버튼을 눌러 볼 수 있게)
const MEMBERS = ["u-minji", "u-jiwoo", "u-minsu", "u-seoyeon"];
const NAME_TO_ID: Record<string, string> = { 민지: "u-minji", 지우: "u-jiwoo", 민수: "u-minsu", 서연: "u-seoyeon" };
/** 팀원에게 보이는 출발 동네 (실제 앱처럼 동네까지만) */
export const DEMO_NEIGHBORHOODS: Record<string, string> = { "u-minji": "대화동", "u-jiwoo": "길음동", "u-minsu": "화양동", "u-seoyeon": "신촌동" };
const DEMO_AREAS = ["서울역", "시청역", "충정로역"];

/** 오늘(서울)에서 dayOffset일 뒤의 "HH:mm" → "2026-11-11T19:00:00+09:00" */
function kst(dayOffset: number, hm: string) {
  const now = new Date(Date.now() + 9 * 3600_000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset));
  return `${d.toISOString().slice(0, 10)}T${hm}:00+09:00`;
}
const slot = (day: number, a: string, b: string): Slot => ({ startAt: kst(day, a), endAt: kst(day, b) });

function conditions(): Conditions {
  // 시간 후보가 '5일 뒤 19시(3명)', '8일 뒤 14시(3명)', '6일 뒤 19시(2명)'로 나오게 짠 예시 대화 결과
  const schedule = {
    teamId: TEAM,
    timezone: "Asia/Seoul" as const,
    searchWindow: { startAt: kst(4, "00:00"), endAt: kst(10, "00:00") },
    durationMinutes: 120,
    requiredMemberIds: [] as string[],
    stepMinutes: 30,
    maxCandidates: 3,
    meetingHours: { start: "09:00", end: "22:00" },
    members: [
      { memberId: "u-minji", responseStatus: "provided" as const, availableSlots: [slot(5, "19:00", "21:00"), slot(6, "19:00", "21:00"), slot(8, "14:00", "16:00")], unavailableSlots: [] },
      { memberId: "u-jiwoo", responseStatus: "needs_confirmation" as const, availableSlots: [], unavailableSlots: [] },
      { memberId: "u-minsu", responseStatus: "provided" as const, availableSlots: [slot(5, "19:00", "21:00"), slot(8, "14:00", "16:00")], unavailableSlots: [slot(6, "09:00", "22:00")] },
      { memberId: "u-seoyeon", responseStatus: "provided" as const, availableSlots: [slot(5, "19:00", "21:00"), slot(6, "19:00", "21:00"), slot(8, "14:00", "16:00")], unavailableSlots: [] },
    ],
  };
  return {
    schedule,
    purpose: "중간발표 자료 역할 분담",
    meetingMode: "offline",
    placeType: "회의 장소",
    agenda: ["발표 목차 확정", "파트별 분량과 담당 나누기", "자료 취합 마감일 정하기"],
    sourceMessageIds: [],
    origins: [],
    placeRequirements: ["노트북 작업"],
  };
}

/** 장소 찾기 결과 (예시 장소 3곳 · 사람별 대중교통 시간) → 실제와 같은 팀 순위 계산 */
function placeResult(timeOptionId: string, areas: string[]): PlaceResult {
  const list = (placesJson as Record<string, { places: { id: string; name: string; url: string; travel: { who: string; minutes: number }[] }[] }>)["p-1"].places;
  const use = areas.length ? areas : DEMO_AREAS;
  const searches: RegionSearch[] = use.map((area, i) => ({
    area,
    status: "ok",
    places: list
      .filter((_, k) => k % use.length === i)
      .map((p) => ({
        placeId: `demo-${p.id}`,
        name: p.name,
        detailUrl: p.url,
        travelTimes: p.travel.map((t) => ({ memberId: NAME_TO_ID[t.who] ?? t.who, minutes: t.minutes, status: "ok" })),
      })),
  }));
  return combineRegionPlaces(timeOptionId, searches, MEMBERS, 60);
}

function initial(): Record<string, StoredProposal> {
  const base = (id: string): StoredProposal => ({
    id,
    teamId: TEAM,
    ownerId: ME,
    memberIds: [...MEMBERS],
    version: 1,
    title: "중간발표 자료 역할 분담",
    mode: "offline",
    conditions: conditions(),
    candidates: [],
    responses: [],
    responseDeadline: kst(2, "21:00"),
    materialDeadline: kst(4, "18:00"),
    meetingUrl: null,
    progress: { step: "times" },
    placeResults: [],
    meeting: null,
  });
  const p1 = base("p-1");
  const first = projectProposal(p1).candidates;
  p1.candidates = first.map(({ explicitAvailableMemberIds: _, ...c }) => c);
  const at = (day: number, hm: string) => first.find((c) => c.startAt === kst(day, hm))?.id ?? "";
  const [A, B, C] = [at(5, "19:00"), at(6, "19:00"), at(8, "14:00")];
  const pick = (memberId: string, ids: string[]): SavedResponse => ({ memberId, kind: "selected", selectedCandidateIds: ids.filter(Boolean), customSlots: [] });
  p1.responses = [pick("u-minji", [A, C]), pick("u-minsu", [A, C]), pick("u-seoyeon", [A, B, C])];

  // 확정된 회의: 모두 응답 → A 시간 · 순위가 있는 장소로 확정
  const m1: StoredProposal = { ...structuredClone(p1), id: "m-1", responses: [...p1.responses, pick("u-jiwoo", [A])], progress: { step: "done" } };
  m1.placeResults = [placeResult(A, DEMO_AREAS)];
  const best = m1.placeResults[0].places.find((p) => p.rank === 1) ?? m1.placeResults[0].places[0];
  const slotA = first.find((c) => c.id === A)!;
  m1.meeting = { id: "m-1", startAt: slotA.startAt, endAt: slotA.endAt, attendeeIds: [...MEMBERS], mode: "offline", meetingUrl: null, place: { id: best.id, name: best.name, url: best.url } };

  // 지난 회의(회의록 예시): 열흘 전 '주제 선정 회의'
  const m0: StoredProposal = { ...structuredClone(m1), id: "m-0", title: "주제 선정 회의" };
  m0.conditions.purpose = "주제 선정 회의";
  m0.conditions.agenda = ["주제 후보 3개 비교", "사전 설문 계획"];
  m0.meeting = { id: "m-0", startAt: kst(-10, "19:00"), endAt: kst(-10, "20:40"), attendeeIds: [...MEMBERS], mode: "offline", meetingUrl: null, place: { id: "demo-B", name: "스터디카페 B · 회의실", url: null } };
  return { "p-1": p1, "m-1": m1, "m-0": m0 };
}

// ── 이 탭에만 저장 ──
const KEY = "syncle-demo-scheduling-v1";
let memory: Record<string, StoredProposal> | null = null;
function store(): Record<string, StoredProposal> {
  if (memory) return memory;
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(KEY) : null;
    if (raw) {
      const saved = JSON.parse(raw) as { day: string; data: Record<string, StoredProposal> };
      if (saved.day === kst(0, "00:00")) return (memory = saved.data); // 날짜가 바뀌면 새로 만들어요
    }
  } catch {
    // 저장소를 못 쓰면 메모리에만 둬요
  }
  return (memory = initial());
}
function save() {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ day: kst(0, "00:00"), data: memory }));
  } catch {
    // 무시 — 새로고침하면 처음 상태로 돌아가요
  }
}
/** 데모를 처음 상태로 (화면 목록의 '처음 상태로 되돌리기'에서 같이 불러요) */
export function resetDemoScheduling() {
  memory = initial();
  save();
}

const view = (p: StoredProposal, extra: Record<string, unknown> = {}) => ({ ...projectProposal(p), viewerId: ME, ...extra });
const wait = () => new Promise((r) => setTimeout(r, 350));

/**
 * C 일정 API 대신 응답해요. 데모 제안 경로가 아니면 null (→ 진짜 서버로).
 * GET proposals/{id} · POST proposals/{id}/{respond|condition|mode|remind|places|confirm}
 */
export function demoSchedulingRequest(path: string, body?: unknown): Promise<unknown> | null {
  const m = path.match(/^proposals\/([^/]+)(?:\/([a-z]+))?$/);
  if (!m || !isDemoProposalId(m[1])) return null;
  const [, id, action] = m;
  return (async () => {
    await wait();
    const all = store();
    const p = all[id];
    if (!action) return view(p);
    const b = (body ?? {}) as Record<string, unknown>;
    let extra: Record<string, unknown> = {};
    if (action === "respond") {
      const r: SavedResponse = {
        memberId: ME,
        kind: (b.kind as SavedResponse["kind"]) ?? "selected",
        selectedCandidateIds: (b.selectedCandidateIds as string[]) ?? [],
        customSlots: (b.customSlots as Slot[]) ?? [],
      };
      p.responses = [...p.responses.filter((x) => x.memberId !== ME), r];
    } else if (action === "condition") {
      const mine = p.conditions.schedule.members.find((x) => x.memberId === ME);
      const s = b.slot as Slot | undefined;
      if (mine && s) {
        if (b.kind === "preferred") mine.preferredSlots = [...(mine.preferredSlots ?? []), s];
        else mine.unavailableSlots = [...mine.unavailableSlots, s];
      }
    } else if (action === "mode") {
      p.mode = b.mode === "online" ? "online" : "offline";
      p.conditions.meetingMode = p.mode;
      p.meetingUrl = typeof b.meetingUrl === "string" && b.meetingUrl ? b.meetingUrl : null;
    } else if (action === "remind") {
      extra = { notifiedCount: projectProposal(p).pendingIds.length };
    } else if (action === "places") {
      const t = String(b.timeOptionId ?? "");
      const areas = Array.isArray(b.searchAreas) ? (b.searchAreas as string[]).filter(Boolean) : [];
      p.placeResults = [...p.placeResults.filter((r) => r.timeOptionId !== t), placeResult(t, areas)];
      p.progress = { step: "places" };
    } else if (action === "confirm") {
      const c = projectProposal(p).candidates.find((x) => x.id === b.timeCandidateId);
      if (!c) throw new Error("확정할 시간을 골라 주세요.");
      const found = p.placeResults.find((r) => r.timeOptionId === c.id)?.places.find((x) => x.id === b.placeId && x.rank !== null);
      if (p.mode === "offline" && !found) throw new Error("이 시간의 장소를 먼저 선택해 주세요.");
      p.meeting = {
        id: p.id,
        startAt: c.startAt,
        endAt: c.endAt,
        attendeeIds: c.explicitAvailableMemberIds.length ? c.explicitAvailableMemberIds : [...p.memberIds],
        mode: p.mode,
        meetingUrl: p.meetingUrl,
        place: found ? { id: found.id, name: found.name, url: found.url } : null,
      };
      p.progress = { step: "done" };
    } else {
      throw new Error("데모에서는 지원하지 않는 요청이에요.");
    }
    p.version += 1;
    save();
    return view(p, extra);
  })();
}

/** 데모의 '찾은 지역 · 찾는 장소' 추천 (실제는 /api/places/areas) */
export function demoPlaceSuggestion() {
  return { areas: [...DEMO_AREAS], keyword: "회의 장소", keywordLabel: "회의 장소", keywordReason: "대화에서 '노트북 가져와서 같이 작업'이라고 해서 골랐어요", unknownCount: 0 };
}

/** 데모 대화방 카드에 쓸 제목 · 한 줄 (제안 · 확정) */
/** fresh=true면 이 탭에 저장된 상태 대신 처음 상태 (서버가 그리는 첫 화면과 맞추려고) */
export function demoCardInfo(id: string, fresh = false): { kind: "proposal" | "confirmed"; title: string; sub: string } | null {
  if (!isDemoProposalId(id)) return null;
  const p = fresh ? initial()[id] : store()[id];
  const label = (iso: string) => {
    const d = new Date(Date.parse(iso) + 9 * 3600_000);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${"일월화수목금토"[d.getUTCDay()]}) ${d.toISOString().slice(11, 16)}`;
  };
  if (p.meeting) return { kind: "confirmed", title: "회의가 확정됐어요", sub: [label(p.meeting.startAt), p.meeting.place?.name ?? "온라인"].join(" · ") };
  return { kind: "proposal", title: p.title, sub: `응답 마감 ${label(p.responseDeadline)} · 되는 시간을 골라 주세요` };
}
