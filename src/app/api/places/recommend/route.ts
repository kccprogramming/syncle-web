/**
 * POST /api/places/recommend  { proposalId, keyword?, origins? }
 *   keyword: 찾을 장소 종류 (AI가 대화에서 고른 것, 예: 합주실)
 *   origins: 팀원이 직접 정한 출발지 { memberId: 역 이름 또는 주소 } — 데모용.
 *            백엔드를 붙이면 화면이 보내지 않고 서버가 각자의 프로필(A)에서 읽어요.
 * → PlaceRecommendation (src/lib/data.ts)
 *
 * KAKAO_REST_API_KEY가 있으면 팀원 출발지 가운데의 지하철역들을 후보 지역으로 잡고,
 * 지역마다 장소를 찾아 팀 기준(src/lib/place-ranking.ts)으로 순위를 매겨요 (src/server/area-search.ts).
 * 키가 없으면 가짜 데이터(src/mocks/places.json)에 같은 기준을 적용해 돌려줘요.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getMember, getMemberOrigin, getPlaces, getProposal, getTeam, type PlaceRecommendation } from "@/lib/data";
import { rankPlaces, RANKING_NOTE } from "@/lib/place-ranking";
import { findFairAreas } from "@/server/area-search";
import { cleanKeyword } from "@/server/places-adapter";

export const dynamic = "force-dynamic";
// 지역 3곳 × 장소 4곳 × 팀원 4명의 경로를 조회해서 몇 초 걸릴 수 있어요
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { proposalId?: string; keyword?: string; origins?: Record<string, unknown> };
  const proposal = getProposal(String(body.proposalId ?? ""));
  const mock = getPlaces(proposal.id);

  if (!process.env.KAKAO_REST_API_KEY) {
    const { places, excluded } = rankPlaces(mock.places);
    const data: PlaceRecommendation = {
      source: "mock",
      timeLabel: mock.timeLabel,
      areas: [{ name: mock.areaLabel, rank: 1, reason: "예시 데이터예요 · 카카오 키를 넣으면 팀원 출발지 가운데의 지역을 찾아요", places, excludedCount: excluded.length }],
      unknownOrigins: [],
      rule: RANKING_NOTE,
      unverified: false,
    };
    return NextResponse.json(data);
  }

  const team = getTeam(proposal.teamId);
  const keyword = cleanKeyword(body.keyword);
  // 각자 직접 정한 출발지가 먼저, 없으면 서버에 저장된 값(지금은 src/mocks/member-origins.json), 그것도 없으면 '미확인'
  const entered = body.origins && typeof body.origins === "object" ? body.origins : {};
  const members = team.memberIds.map((id) => {
    const mine = entered[id];
    const origin = typeof mine === "string" && mine.trim() ? mine.trim().slice(0, 100) : getMemberOrigin(id);
    return { memberId: id, name: getMember(id).name, ...(origin ? { origin } : {}) };
  });

  try {
    const { areas, unknownOrigins } = await findFairAreas({ keyword, members });
    const data: PlaceRecommendation = { source: "kakao", timeLabel: mock.timeLabel, areas, unknownOrigins, rule: RANKING_NOTE, unverified: true };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[places/recommend]", err);
    const message = err instanceof Error && !("detail" in err) ? err.message : "장소를 찾지 못했어요. 잠시 뒤 다시 찾아 주세요";
    return NextResponse.json({ error: { code: "PLACE_SEARCH_FAILED", message } }, { status: 502 });
  }
}
