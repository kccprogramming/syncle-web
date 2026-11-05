import { fetchKakaoJson, KakaoApiError } from './kakaoApiError.ts';

type KakaoDocument = {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  x: string;
  y: string;
  place_url: string;
};

const pageSize = 3;
export const kakaoKeywordPageLimit = Math.ceil(45 / pageSize);
export const maxSearchRadiusMeters = 20_000;

type Coordinates = { latitude: number; longitude: number };
export type SearchBounds = Coordinates & { radiusMeters: number };

export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const radians = Math.PI / 180;
  const lat = (to.latitude - from.latitude) * radians;
  const lon = (to.longitude - from.longitude) * radians;
  const a = Math.sin(lat / 2) ** 2 + Math.cos(from.latitude * radians) *
    Math.cos(to.latitude * radians) * Math.sin(lon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, a)));
}

export async function searchKakaoPlaces(query: string) {
  return (await searchKakaoPlacePage(query)).places;
}

export async function searchKakaoPlacePage(query: string, page?: number, bounds?: SearchBounds) {
  const keyword = query.trim();
  if (!keyword) throw new Error('검색어를 입력해 주세요.');

  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', keyword);
  url.searchParams.set('size', String(pageSize));
  if (page !== undefined) url.searchParams.set('page', String(page));
  if (bounds) {
    url.searchParams.set('x', String(bounds.longitude));
    url.searchParams.set('y', String(bounds.latitude));
    url.searchParams.set('radius', String(bounds.radiusMeters));
  }

  const result = await fetchKakaoJson(url, 'place_search') as { documents?: KakaoDocument[]; meta?: { is_end?: boolean } } | null;
  if (!Array.isArray(result?.documents) || result.documents.some((place) =>
    typeof place?.id !== 'string' || !place.id.trim() ||
    typeof place.place_name !== 'string' || !place.place_name.trim())) {
    throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'place_search');
  }

  if ((page !== undefined || bounds) && typeof result.meta?.is_end !== 'boolean') {
    throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'place_search');
  }

  const places = result.documents.slice(0, pageSize).map((place) => ({
    placeId: place.id,
    name: place.place_name,
    address: place.road_address_name || place.address_name,
    latitude: typeof place.y === 'string' && place.y.trim() ? Number(place.y) : NaN,
    longitude: typeof place.x === 'string' && place.x.trim() ? Number(place.x) : NaN,
    detailUrl: place.place_url,
  }));
  return { places, isEnd: result.meta?.is_end !== false };
}
