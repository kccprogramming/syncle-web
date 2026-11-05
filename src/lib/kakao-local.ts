/**
 * 카카오 로컬 API 부르기 (서버 라우트에서만 불러요. 키 이름에 NEXT_PUBLIC_이 없어서 브라우저로는 안 넘어가요).
 * /api/places/search 라우트가 이 함수를 불러요. 화면에서는 data.ts의 searchPlaces를 써요.
 *
 * 키 넣는 법: 프로젝트 맨 위에 .env.local 파일을 만들고
 *   KAKAO_REST_API_KEY=발급받은_REST_API_키
 * 를 적은 뒤 npm run dev를 다시 켜요. (.env.example 참고, .env.local은 git에 올라가지 않아요)
 */
import { kakaoToSearchResult } from "@/lib/data";
import type { KakaoAddressSearchResponse, KakaoKeywordSearchResponse, PlaceSearchResult } from "@/types";

const BASE = "https://dapi.kakao.com/v2/local/search";

export function hasKakaoKey() {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}

async function kakaoGet<T>(path: string, query: string, size: number): Promise<T> {
  const url = `${BASE}/${path}?query=${encodeURIComponent(query)}&size=${size}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kakao ${path} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * 이름(키워드)과 주소를 같이 찾아서 합쳐요.
 * - "국민대학교", "대화역" → 키워드 검색이 찾아요
 * - "정릉로 77", "성북구 정릉동" → 주소 검색이 찾아요
 * 같은 주소가 장소 이름 결과와 주소 결과에 둘 다 나오면 장소 이름 쪽만 남겨요.
 */
export async function searchKakaoPlaces(query: string): Promise<PlaceSearchResult[]> {
  const [keyword, address] = await Promise.all([
    kakaoGet<KakaoKeywordSearchResponse>("keyword.json", query, 15),
    kakaoGet<KakaoAddressSearchResponse>("address.json", query, 10),
  ]);

  const fromKeyword = keyword.documents.map(kakaoToSearchResult);
  const fromAddress: PlaceSearchResult[] = address.documents.map((d) => {
    const road = d.road_address?.address_name ?? "";
    const jibun = d.address?.address_name ?? d.address_name;
    return {
      id: `addr-${d.x}-${d.y}`,
      name: d.road_address?.building_name || road || jibun,
      roadAddress: road || jibun,
      address: jibun,
      lat: Number(d.y),
      lng: Number(d.x),
      area: d.address?.region_3depth_name || d.road_address?.region_3depth_name || "",
    };
  });

  // 장소 이름 결과가 이미 있는 주소는 주소 결과를 빼요 (이름이 있는 쪽이 더 알아보기 쉬워요).
  // 같은 건물에 있는 다른 장소(예: 을지로 100의 파인에비뉴빌딩, 신한카드 본사)는 모두 남겨요.
  const namedRoads = new Set(fromKeyword.map((r) => r.roadAddress));
  const addressOnly = fromAddress.filter((r) => !namedRoads.has(r.roadAddress));

  // 주소를 입력한 것 같으면(숫자가 있으면) 주소 결과를 먼저, 아니면 장소 이름 결과를 먼저 보여줘요
  const looksLikeAddress = /\d/.test(query);
  const merged = looksLikeAddress ? [...addressOnly, ...fromKeyword] : [...fromKeyword, ...addressOnly];
  const seen = new Set<string>();
  return merged.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
