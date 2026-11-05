/**
 * GET /api/places/search?query=국민대학교
 * → { results: PlaceSearchResult[], source: "kakao" | "mock" }
 *
 * .env.local에 KAKAO_REST_API_KEY가 있으면 카카오 로컬 API로, 없으면 가짜 데이터로 찾아요.
 * 카카오 키가 브라우저에 보이지 않도록 이 서버 라우트를 거쳐요.
 */
import { NextResponse, type NextRequest } from "next/server";
import { searchMockPlaces } from "@/lib/data";
import { hasKakaoKey, searchKakaoPlaces } from "@/lib/kakao-local";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("query") ?? "").trim().slice(0, 100);
  if (!query) return NextResponse.json({ results: [], source: hasKakaoKey() ? "kakao" : "mock" });

  if (!hasKakaoKey()) {
    return NextResponse.json({ results: searchMockPlaces(query), source: "mock" });
  }

  try {
    return NextResponse.json({ results: await searchKakaoPlaces(query), source: "kakao" });
  } catch (err) {
    // 키가 틀렸거나(401) 카카오 콘솔에서 '카카오맵' 사용 설정이 꺼져 있으면(403) 여기로 와요
    console.error("[places/search]", err);
    return NextResponse.json({ error: "장소 검색에 실패했어요" }, { status: 502 });
  }
}
