import { fetchKakaoJson, kakaoErrorDetail, KakaoApiError } from './kakaoApiError.ts';
import { geocodeAddress } from './geocodeAddress.ts';

const stationLineSuffix = /\s+\S+선$/;

export async function resolveOrigin(origin: string): ReturnType<typeof geocodeAddress> {
  const query = origin.trim().replace(/\s+/g, ' ');
  const stationName = query.replace(stationLineSuffix, '');
  if (!stationName.endsWith('역')) return geocodeAddress(query);

  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.search = new URLSearchParams({ query, category_group_code: 'SW8', size: '15' }).toString();

  try {
    const result = await fetchKakaoJson(url, 'origin_search') as {
      meta?: { is_end?: boolean };
      documents?: Array<{ place_name: string; x: string; y: string }>;
    } | null;
    if (!Array.isArray(result?.documents) || typeof result.meta?.is_end !== 'boolean' ||
        result.documents.some((station) => typeof station?.place_name !== 'string')) {
      throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'origin_search');
    }
    const { documents } = result;
    if (documents.length === 0 && result.meta.is_end) return { status: 'unknown', reason: 'not_found' };

    const hasLine = stationName !== query;
    const matches = documents.filter(({ place_name }) => hasLine
      ? place_name === query
      : place_name.replace(stationLineSuffix, '') === query);
    if (!result.meta.is_end || matches.length !== 1 || (!hasLine && documents.length !== 1)) {
      return { status: 'unknown', reason: 'confirmation_required' };
    }

    const { x, y } = matches[0];
    const latitude = Number(y);
    const longitude = Number(x);
    if (typeof x !== 'string' || !x.trim() || typeof y !== 'string' || !y.trim() ||
        !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'origin_search');
    }
    return { status: 'ok', latitude, longitude };
  } catch (error) {
    const detail = kakaoErrorDetail(error, 'origin_search');
    return { status: 'error', message: detail.message, httpStatus: detail.httpStatus, error: detail };
  }
}
