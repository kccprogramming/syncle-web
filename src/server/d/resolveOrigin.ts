import { fetchKakaoJson, kakaoErrorDetail, KakaoApiError } from './kakaoApiError.ts';
import { geocodeAddress } from './geocodeAddress.ts';
import { distanceMeters } from './searchKakaoPlaces.ts';

const stationLineSuffix = /\s+\S+선$/;
const areaLineSuffix = /\s+(?:\S+선|공항철도|GTX-[A-Z])$/;

export async function resolveOrigin(origin: string, options: { stationArea?: boolean } = {}): ReturnType<typeof geocodeAddress> {
  const query = origin.trim().replace(/\s+/g, ' ');
  const suffix = options.stationArea ? areaLineSuffix : stationLineSuffix;
  const stationName = query.replace(suffix, '');
  if (!stationName.endsWith('역')) return geocodeAddress(query);

  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.search = new URLSearchParams({ query, category_group_code: 'SW8', size: '15' }).toString();

  try {
    type StationPage = {
      meta?: { is_end?: boolean };
      documents?: Array<{ place_name: string; x: string; y: string }>;
    };
    const hasLine = stationName !== query;
    const allowStationCluster = options.stationArea && !hasLine;
    const documents: NonNullable<StationPage['documents']> = [];
    let isEnd = false;
    // 카카오 키워드 검색은 최대 45건을 노출하며 이 요청은 페이지당 15건을 사용한다.
    for (let page = 1; page <= (options.stationArea ? 3 : 1); page++) {
      if (page > 1) url.searchParams.set('page', String(page));
      const result = await fetchKakaoJson(url, 'origin_search') as StationPage | null;
      if (!Array.isArray(result?.documents) || typeof result.meta?.is_end !== 'boolean' ||
          result.documents.some((station) => typeof station?.place_name !== 'string')) {
        throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'origin_search');
      }
      documents.push(...result.documents);
      isEnd = result.meta.is_end;
      if (isEnd) break;
    }
    if (documents.length === 0 && isEnd) return { status: 'unknown', reason: 'not_found' };
    const matches = documents.filter(({ place_name }) => hasLine
      ? place_name === query
      : place_name.replace(suffix, '') === query);
    if (!isEnd || matches.length === 0 ||
        (!allowStationCluster && (matches.length !== 1 || (!hasLine && documents.length !== 1)))) {
      return { status: 'unknown', reason: 'confirmation_required' };
    }

    const points: { latitude: number; longitude: number }[] = [];
    for (const { x, y } of matches) {
      const latitude = Number(y);
      const longitude = Number(x);
      if (typeof x !== 'string' || !x.trim() || typeof y !== 'string' || !y.trim() ||
          !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
          !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'origin_search');
      }
      if (points.some((point) => distanceMeters(point, { latitude, longitude }) > 600)) {
        return { status: 'unknown', reason: 'confirmation_required' };
      }
      points.push({ latitude, longitude });
    }
    return {
      status: 'ok',
      latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
      longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
    };
  } catch (error) {
    const detail = kakaoErrorDetail(error, 'origin_search');
    return { status: 'error', message: detail.message, httpStatus: detail.httpStatus, error: detail };
  }
}
