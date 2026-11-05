/**
 * 공평한 지역 찾기 (서버에서만 써요).
 *
 * 1. 팀원 출발지를 좌표로 바꿔요 (D resolveOrigin)
 * 2. 출발지들의 가운데 지점에서 가까운 지하철역을 후보 지역으로 골라요 (카카오 지하철역 카테고리 SW8)
 * 3. 각 지역의 역 반경 안에서 AI가 고른 장소 종류를 찾아요 (카카오 키워드 검색 + 좌표·반경 제한)
 * 4. 팀원마다 장소까지 대중교통 시간을 재요 (D getTransitRoute)
 * 5. 팀 기준(place-ranking.ts)으로 지역 안 장소와 지역끼리 순위를 매겨요
 *
 * D의 findPlaces는 "검색 지역 + 장소 종류" 글자로만 검색해서 다른 동네 장소가 섞여 나와요.
 * 그래서 장소 검색은 여기서 좌표·반경으로 제한하고, 출발지·경로 계산은 D 함수를 그대로 써요.
 */
import type { PlaceOption } from "@/types";
import { compareAreas, rankPlaces } from "@/lib/place-ranking";
import { fetchKakaoJson, KakaoApiError } from "./d/kakaoApiError.ts";
import { resolveOrigin } from "./d/resolveOrigin.ts";
import { getTransitRoute } from "./d/getTransitRoute.ts";

type LatLng = { latitude: number; longitude: number };
type Doc = { id: string; place_name: string; road_address_name: string; address_name: string; x: string; y: string; place_url: string; distance?: string };

export interface AreaResult {
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

const AREA_COUNT = 3; // 후보 지역 수
const PLACES_PER_AREA = 2; // 지역마다 보여줄 장소 수
const SEARCH_PER_AREA = 4; // 제한으로 빠질 수 있어서 조금 더 찾아요
const AREA_RADIUS_M = 1000; // 역에서 이 거리 안의 장소만
const WIDE_RADIUS_M = 2500; // 1km 안에 없으면 넓혀서 한 번 더
const MIN_STATION_GAP_KM = 1.5; // 후보 지역끼리 이만큼은 떨어지게 (같은 장소가 겹치지 않게)
const CONCURRENCY = 6; // 카카오 동시 요청 수

/** 한 번에 너무 많이 부르지 않게 나눠서 실행 */
async function pool<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function kakao(path: string, params: Record<string, string>): Promise<Doc[]> {
  const url = new URL(`https://dapi.kakao.com/v2/local/search/${path}`);
  url.search = new URLSearchParams(params).toString();
  const body = (await fetchKakaoJson(url, "place_search")) as { documents?: Doc[] } | null;
  if (!Array.isArray(body?.documents)) throw new KakaoApiError("KAKAO_INVALID_RESPONSE", "place_search");
  return body.documents;
}

/** "종로3가역 1호선" → "종로3가역" */
const stationBase = (name: string) => name.match(/^(.+?역)/)?.[1] ?? name;

function km(a: LatLng, b: LatLng) {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r;
  const dLng = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * 팀원 출발지 가운데 근처 지하철역 3곳 (서로 1.5km 이상) = 후보 지역.
 * findFairAreas의 1~2단계예요. 실제 제안(C)의 장소 찾기에 넘길 지역 이름을 정할 때도 써요.
 */
export async function findCenterStations<M extends { name: string; origin?: string }>(members: M[]) {
  // 1. 출발지 → 좌표
  const resolved = await pool(members, async (m) => ({ m, r: m.origin ? await resolveOrigin(m.origin) : null }));
  const located = resolved.flatMap(({ m, r }) => (r && r.status === "ok" ? [{ ...m, at: { latitude: r.latitude, longitude: r.longitude } }] : []));
  const unknownOrigins = resolved.filter(({ r }) => !r || r.status !== "ok").map(({ m }) => m.name);
  if (located.length < 2) {
    throw new Error("출발지를 확인한 팀원이 2명 이상이어야 공평한 지역을 찾을 수 있어요");
  }

  // 2. 가운데 지점 근처 지하철역 = 후보 지역
  const center: LatLng = {
    latitude: located.reduce((s, m) => s + m.at.latitude, 0) / located.length,
    longitude: located.reduce((s, m) => s + m.at.longitude, 0) / located.length,
  };
  const stationDocs = await kakao("category.json", {
    category_group_code: "SW8",
    x: String(center.longitude),
    y: String(center.latitude),
    radius: "8000",
    sort: "distance",
    size: "15",
  });
  const stations: { name: string; at: LatLng }[] = [];
  for (const d of stationDocs) {
    const name = stationBase(d.place_name);
    const at = { latitude: Number(d.y), longitude: Number(d.x) };
    if (stations.some((s) => s.name === name || km(s.at, at) < MIN_STATION_GAP_KM)) continue;
    stations.push({ name, at });
    if (stations.length === AREA_COUNT) break;
  }
  if (stations.length === 0) throw new Error("팀원 출발지 가운데 근처에서 지하철역을 찾지 못했어요");
  return { located, unknownOrigins, center, stations };
}

export async function findFairAreas(args: {
  keyword: string;
  members: { memberId: string; name: string; origin?: string }[];
}): Promise<{ areas: AreaResult[]; unknownOrigins: string[] }> {
  const { keyword, members } = args;
  const { located, unknownOrigins, center, stations } = await findCenterStations(members);

  // 3. 지역마다 장소 찾기 (역 반경 1km, 없으면 2.5km). 같은 장소는 가운데에 더 가까운 지역에만 둬요
  const search = (s: { at: LatLng }, radius: number) =>
    kakao("keyword.json", { query: keyword, x: String(s.at.longitude), y: String(s.at.latitude), radius: String(radius), size: "15", sort: "distance" });
  const found = await pool(stations, async (s) => {
    let docs = await search(s, AREA_RADIUS_M);
    let radius = AREA_RADIUS_M;
    if (docs.length === 0) {
      docs = await search(s, WIDE_RADIUS_M);
      radius = WIDE_RADIUS_M;
    }
    return { docs, radius };
  });
  const used = new Set<string>();
  const areaDocs = found.map(({ docs }) => {
    const mine = docs.filter((d) => !used.has(d.id)).slice(0, SEARCH_PER_AREA);
    mine.forEach((d) => used.add(d.id));
    return mine;
  });

  // 4. 팀원 × 장소 대중교통 시간 (같은 경로는 한 번만)
  const routeCache = new Map<string, Promise<number | null>>();
  const travelMinutes = (from: LatLng, to: LatLng) => {
    const key = JSON.stringify([from, to]);
    if (!routeCache.has(key)) {
      routeCache.set(
        key,
        getTransitRoute(from, to).then((r) => (r.status === "ok" ? r.minutes : null)),
      );
    }
    return routeCache.get(key)!;
  };
  const jobs = areaDocs.flatMap((docs, ai) => docs.map((d) => ({ ai, d })));
  const withTravel = await pool(jobs, async ({ ai, d }) => {
    const to = { latitude: Number(d.y), longitude: Number(d.x) };
    const travel = await Promise.all(
      members.map(async (m) => {
        const me = located.find((x) => x.memberId === m.memberId);
        return { who: m.name, minutes: me ? await travelMinutes(me.at, to) : null };
      }),
    );
    return { ai, d, to, travel };
  });

  // 5. 지역 안 순위 → 지역끼리 순위
  const areas = stations.map((s, ai) => {
    const docs = withTravel.filter((x) => x.ai === ai);
    const options: PlaceOption[] = docs.map(({ d, travel }) => ({
      id: d.id,
      label: "",
      name: d.place_name,
      short: d.place_name,
      walk: `${s.name} 도보 약 ${Math.max(1, Math.round(Number(d.distance ?? 0) / 67))}분`,
      address: d.road_address_name || d.address_name,
      url: d.place_url || `https://map.kakao.com/link/search/${encodeURIComponent(d.place_name)}`,
      maxMinutes: null,
      travel,
      reason: "",
      pin: { x: 50, y: 50 },
    }));
    const { places, excluded } = rankPlaces(options);
    const shown = places.slice(0, PLACES_PER_AREA);
    const pins = pinPositions(shown.map((p) => docs.find((x) => x.d.id === p.id)!.to), s.at);
    return {
      name: s.name,
      radius: found[ai].radius,
      distanceKm: km(center, s.at),
      places: shown.map((p, i) => ({ ...p, label: String.fromCharCode(65 + i), pin: pins[i] })),
      excludedCount: excluded.length,
      searchedCount: docs.length,
    };
  });

  areas.sort((a, b) => compareAreas(a.places.find((p) => p.rank !== null), b.places.find((p) => p.rank !== null)));
  let rankNo = 0;
  return {
    unknownOrigins,
    areas: areas.map((a) => {
      const best = a.places.find((p) => p.rank !== null);
      const rank = best ? ++rankNo : null;
      return { name: a.name, rank, excludedCount: a.excludedCount, places: a.places, reason: areaReason(a, best, rank) };
    }),
  };
}

function areaReason(
  a: { name: string; radius: number; distanceKm: number; excludedCount: number; searchedCount: number },
  best: PlaceOption | undefined,
  rank: number | null,
): string {
  const where = `팀원 출발지 가운데에서 ${a.distanceKm.toFixed(1)}km`;
  const cut = a.excludedCount ? ` · 1시간 넘는 곳 ${a.excludedCount}곳은 뺐어요` : "";
  const wide = a.radius > AREA_RADIUS_M ? ` · 역 ${a.radius / 1000}km 안에서 찾았어요` : "";
  if (a.searchedCount === 0) return `${where} · 역 ${a.radius / 1000}km 안에 맞는 장소가 없어요`;
  if (!best || rank === null) return `${where} · 모두가 1시간 안에 갈 수 있는 곳이 없어요${cut}`;
  return `${where} · 가장 고른 곳은 차이 ${best.diffMinutes}분, 가장 먼 사람 ${best.maxMinutes}분${cut}${wide}`;
}

/** 지도 그림 위 핀 위치(%): 역을 가운데에 두고 장소를 펼쳐요 */
function pinPositions(points: LatLng[], center: LatLng): { x: number; y: number }[] {
  const all = [center, ...points];
  const lats = all.map((p) => p.latitude);
  const lngs = all.map((p) => p.longitude);
  const spanLat = Math.max(...lats) - Math.min(...lats) || 0.001;
  const spanLng = Math.max(...lngs) - Math.min(...lngs) || 0.001;
  return points.map((p, i) => {
    const x = 50 + ((p.longitude - center.longitude) / spanLng) * 70;
    const y = 50 - ((p.latitude - center.latitude) / spanLat) * 60;
    const clamp = (v: number) => Math.round(Math.min(88, Math.max(12, v)));
    return { x: clamp(x), y: clamp(y + (i % 2 ? 6 : -6)) };
  });
}
