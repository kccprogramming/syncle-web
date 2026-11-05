/**
 * 우리 앱 ↔ D(장소 추천) 연결 계층. 서버에서만 써요.
 *
 * - toDRequest: 회의 제안(proposal)과 시간 후보, 팀원 출발지 → D findPlaces 입력 (D_CONTRACT.md 3장)
 * - toPlaceOptions: D findPlaces 결과 → 6 장소 후보 화면의 PlaceOption[] (D_CONTRACT.md 4장)
 *
 * D 코드(src/server/d)는 받은 그대로 두고, 이름·모양을 맞추는 일은 여기서만 해요.
 */
import type { PlaceOption, Proposal, TimeOption } from "@/types";
import type { findPlaces } from "./d/findPlaces.ts";

type DResult = Awaited<ReturnType<typeof findPlaces>>;
type DPlace = Extract<DResult, { status: "ok" }>["places"][number];

/**
 * D는 "검색 지역 + 장소 종류"로 카카오 키워드 검색을 해요 (예: "서울역 스터디룸").
 * 회의 목적("중간발표 자료 역할 분담")을 그대로 넣으면 검색이 잘 안 돼서, 장소 종류를 따로 정해요.
 * TODO: C와 합의 — 목적에서 장소 종류를 뽑을지, 사용자가 고르게 할지 (D_CONTRACT.md 8장)
 */
export const DEFAULT_PLACE_KEYWORD = "스터디룸";

export function toDRequest(args: {
  proposal: Proposal;
  time: TimeOption;
  searchArea: string;
  members: { memberId: string; origin?: string }[];
}) {
  const { proposal, time, searchArea, members } = args;
  return {
    teamId: proposal.teamId,
    proposalId: proposal.id,
    timeOptionId: time.id,
    meetingPurpose: DEFAULT_PLACE_KEYWORD,
    startAt: time.startAt,
    endAt: time.endAt,
    meetingMode: proposal.mode,
    dataMode: "api" as const,
    searchArea,
    expectedAttendeeCount: members.length,
    ...(proposal.placeNote ? { preferredConditions: [proposal.placeNote] } : {}),
    members,
  };
}

/** D 결과의 장소 → 화면 카드. 순위가 있는 곳을 앞에, 같은 순위 안에서는 D가 준 순서대로 */
export function toPlaceOptions(places: DPlace[], nameOf: (memberId: string) => string): PlaceOption[] {
  const sorted = [...places].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const pins = pinPositions(sorted);
  return sorted.map((p, i) => {
    const label = String.fromCharCode(65 + i); // A, B, C …
    const travel = p.travelTimes.map((t) => ({ who: nameOf(t.memberId), minutes: t.minutes }));
    return {
      id: p.placeId,
      label,
      name: p.name,
      short: p.name,
      walk: p.address ?? "주소 미확인",
      address: p.address,
      url: p.detailUrl ?? `https://map.kakao.com/link/search/${encodeURIComponent(p.name)}`,
      maxMinutes: p.maxTravelMinutes,
      diffMinutes: p.travelTimeDifference,
      rank: p.rank,
      travel,
      reason: friendlyReason(p, travel),
      pin: pins[i],
    };
  });
}

/** D의 추천 이유 문장을 화면 말투로 바꿔요. 순위를 못 매긴 경우엔 누구를 확인 못 했는지 알려줘요 */
function friendlyReason(p: DPlace, travel: PlaceOption["travel"]): string {
  if (p.rank !== null && p.maxTravelMinutes !== null) {
    return `가장 오래 걸리는 사람이 ${p.maxTravelMinutes}분이라 ${p.rank}위예요 · 사람 간 차이 ${p.travelTimeDifference}분`;
  }
  const unknown = travel.filter((t) => t.minutes === null).map((t) => t.who);
  if (unknown.length) return `${unknown.join(", ")}님의 이동시간을 확인하지 못해 순위를 매기지 않았어요`;
  return p.recommendationReason;
}

/** 지도 그림 위 핀 위치(%): 장소 좌표를 지도 영역 안에 골고루 펼쳐요 */
function pinPositions(places: DPlace[]): { x: number; y: number }[] {
  const coords = places.map((p) => p.coordinates);
  const lats = coords.flatMap((c) => (c ? [c.latitude] : []));
  const lngs = coords.flatMap((c) => (c ? [c.longitude] : []));
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return coords.map((c, i) => {
    if (!c || lats.length < 2) return { x: 30 + i * 25, y: 40 + (i % 2) * 25 };
    const x = maxLng === minLng ? 50 : 18 + ((c.longitude - minLng) / (maxLng - minLng)) * 64;
    const y = maxLat === minLat ? 50 : 18 + ((maxLat - c.latitude) / (maxLat - minLat)) * 60;
    return { x: Math.round(x), y: Math.round(y) };
  });
}
