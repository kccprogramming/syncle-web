/**
 * POST /api/places/recommend  { proposalId, keyword?, origins? }
 *   keyword: 찾을 장소 종류 (스터디룸, 합주실 …)
 *   origins: 팀원이 직접 정한 출발지 { memberId: 역 이름 또는 주소 } — 데모용.
 *            백엔드를 붙이면 화면이 보내지 않고 서버가 각자의 프로필(A)에서 읽어요.
 * → PlaceRecommendation (src/lib/data.ts)
 *
 * KAKAO_REST_API_KEY가 있으면 D 모듈(src/server/d/findPlaces.ts)로 실제 장소와 대중교통 시간을 찾고,
 * 없으면 가짜 데이터(src/mocks/places.json)를 돌려줘요.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getMember, getMemberOrigin, getPlaces, getProposal, getTeam, type PlaceRecommendation } from "@/lib/data";
import { findPlaces } from "@/server/d/findPlaces.ts";
import { cleanKeyword, toDRequest, toPlaceOptions } from "@/server/places-adapter";

export const dynamic = "force-dynamic";
// 장소 2곳 × 팀원 4명의 경로를 하나씩 조회해서 몇 초 걸릴 수 있어요
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { proposalId?: string; keyword?: string; origins?: Record<string, unknown> };
  const proposal = getProposal(String(body.proposalId ?? ""));
  const mock = getPlaces(proposal.id);
  const time = proposal.times.find((t) => t.recommended) ?? proposal.times[0];

  if (!process.env.KAKAO_REST_API_KEY) {
    const data: PlaceRecommendation = { source: "mock", ...mock, unverified: false };
    return NextResponse.json(data);
  }

  const team = getTeam(proposal.teamId);
  const keyword = cleanKeyword(body.keyword);
  // 각자 직접 정한 출발지가 먼저, 없으면 서버에 저장된 값(지금은 src/mocks/member-origins.json), 그것도 없으면 '미확인'
  const entered = body.origins && typeof body.origins === "object" ? body.origins : {};
  const members = team.memberIds.map((id) => {
    const mine = entered[id];
    const origin = typeof mine === "string" && mine.trim() ? mine.trim().slice(0, 100) : getMemberOrigin(id);
    return origin ? { memberId: id, origin } : { memberId: id };
  });

  // TODO: 검색 지역은 C가 정해 줘야 해요. 지금은 제안 데이터의 지역(예: 서울역)을 써요.
  const searchArea = mock.areaLabel;
  const result = await findPlaces(toDRequest({ proposal, time, searchArea, keyword, members }), { previewUnverified: true });

  if (result.status === "error") {
    console.error("[places/recommend]", result.error);
    const status = result.error.code === "INVALID_INPUT" ? 400 : 502;
    return NextResponse.json({ error: { code: result.error.code, message: result.error.message } }, { status });
  }

  const places = toPlaceOptions(result.places, (id) => getMember(id).name);
  const data: PlaceRecommendation = {
    source: "kakao",
    areaLabel: searchArea,
    title: places.length ? `${searchArea} 주변 ${keyword} ${places.length}곳` : `${searchArea} 주변 ${keyword} 검색 결과가 없어요`,
    timeLabel: mock.timeLabel,
    places,
    unverified: "preview" in result && result.preview?.venueConditions === "unverified",
  };
  return NextResponse.json(data);
}
