/**
 * POST /api/places/areas  { proposalId }   (Authorization: Bearer 로그인 토큰)
 * → { areas: string[], keyword, keywordLabel, keywordReason, unknownCount }
 *
 * 실제 제안(C)의 장소 찾기에 넘길 '비교할 지역'과 '찾을 장소'를 정해 줘요.
 * - 지역: 팀원 출발지 가운데 근처 지하철역 3곳 (src/server/area-search.ts, 6 데모와 같은 방법)
 *   팀원 출발지는 A의 서버 전용 함수(005)로만 읽고, 응답에는 역 이름만 돌려줘요 (출발지는 절대 보내지 않아요).
 * - 장소 종류: 제안의 목적 · 안건 · 장소 조건을 보고 고른 것 (src/lib/place-intent.ts)
 * 화면은 이 값을 C의 POST /api/scheduling/proposals/{id}/places 에 searchAreas · keyword로 넘겨요.
 */
import { authenticated, errorResponse, jsonBody, ok, rpc } from "@/server/scheduling/service";
import type { StoredProposal } from "@/features/scheduling/proposals";
import { loadPrivateTeamOriginsForCalculation, TeamOriginLoadError } from "@/server/a/private-team-origins";
import { findCenterStations } from "@/server/area-search";
import { inferPlaceIntent } from "@/lib/place-intent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { db } = await authenticated(request);
    const body = await jsonBody(request);
    const proposal = await rpc<StoredProposal>(db, "c_schedule_get", { p_id: String(body.proposalId ?? "") });
    const intent = inferPlaceIntent([proposal.title, ...proposal.conditions.placeRequirements, ...proposal.conditions.agenda]);

    if (!process.env.KAKAO_REST_API_KEY) {
      return Response.json({ ok: false, error: { code: "KAKAO_NOT_CONFIGURED", message: "카카오 키가 없어서 지역을 찾지 못했어요. 직접 입력해 주세요." } }, { status: 503 });
    }
    let origins;
    try {
      origins = await loadPrivateTeamOriginsForCalculation(request, proposal.teamId);
    } catch (e) {
      if (e instanceof TeamOriginLoadError) return Response.json({ ok: false, error: { code: e.code, message: e.message } }, { status: e.status });
      throw e;
    }
    const members = origins.map((o, i) => ({ name: `팀원${i + 1}`, origin: o.origin ?? undefined }));
    let found;
    try {
      found = await findCenterStations(members);
    } catch (e) {
      const message = e instanceof Error ? e.message : "지역을 찾지 못했어요";
      return Response.json({ ok: false, error: { code: "AREA_NOT_FOUND", message } }, { status: 409 });
    }
    return ok({
      areas: found.stations.map((s) => s.name),
      keyword: intent.keyword,
      keywordLabel: intent.label,
      keywordReason: intent.reason,
      unknownCount: found.unknownOrigins.length,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
