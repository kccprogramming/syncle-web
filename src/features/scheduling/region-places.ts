import type { PlaceResult } from './proposals';
import { rankPlacesByFairness } from './rank-places-team-rule';

export type RegionSearch = {
  area: string;
  status: 'ok' | 'error';
  places: readonly {
    placeId: string; name: string; detailUrl?: string;
    travelTimes: readonly { memberId: string; minutes: number | null; status: string }[];
  }[];
};

/** Re-rank the whole region set; a per-region rank cannot select the fairest area. */
export function combineRegionPlaces(
  timeOptionId: string, searches: readonly RegionSearch[], memberIds: readonly string[], travelLimitMinutes: number,
  checkedAt = new Date().toISOString(),
): PlaceResult {
  const seen = new Set<string>();
  const candidates = searches.flatMap(search => search.status === 'ok' ? search.places.map(place => {
    if (seen.has(place.placeId)) return null;
    seen.add(place.placeId);
    const travel = memberIds.map(memberId => {
      const found = place.travelTimes.find(item => item.memberId === memberId);
      return { memberId, status: found?.status ?? 'unknown', minutes: found?.status === 'ok' ? found.minutes : null };
    });
    return { placeId: place.placeId, name: place.name, area: search.area, detailUrl: place.detailUrl,
      travelTimes: travel, matchedPreferredConditionCount: 0 };
  }).filter((item): item is NonNullable<typeof item> => item !== null) : []);
  const ranked = rankPlacesByFairness(candidates, travelLimitMinutes);
  const failedCount = searches.filter(search => search.status === 'error').length;
  return {
    timeOptionId, checkedAt, status: failedCount ? 'error' : 'ok',
    searchAreas: searches.map(search => search.area), travelLimitMinutes,
    places: ranked.map(place => ({ id: place.placeId, name: place.name, area: place.area,
      url: place.detailUrl ?? null, rank: place.rank, maxTravelMinutes: place.maxTravelMinutes,
      travelTimeDifference: place.travelTimeDifference, reason: place.recommendationReason, travel: place.travelTimes })),
    ...(failedCount ? { error: { code: 'PLACE_SEARCH_PARTIAL', message: `${failedCount}개 지역의 장소 검색에 실패했어요.` } } : {}),
  };
}
