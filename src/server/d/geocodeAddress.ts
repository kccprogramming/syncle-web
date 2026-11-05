import { fetchKakaoJson, kakaoErrorDetail, KakaoApiError, type KakaoErrorDetail } from './kakaoApiError.ts';

type GeocodeResult =
  | { status: 'ok'; latitude: number; longitude: number }
  | { status: 'unknown'; reason: 'not_found' | 'confirmation_required' }
  | { status: 'error'; message: string; httpStatus?: number; error?: KakaoErrorDetail };

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const query = address.trim();
  if (!query) return { status: 'error', message: '출발지 주소를 입력해 주세요.' };

  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.search = new URLSearchParams({ query, analyze_type: 'exact', size: '2' }).toString();

  try {
    const result = await fetchKakaoJson(url, 'origin_search') as {
      meta?: { is_end?: boolean };
      documents?: Array<{ address_type?: string; x?: string; y?: string }>;
    } | null;
    if (!Array.isArray(result?.documents) || typeof result.meta?.is_end !== 'boolean') {
      throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'origin_search');
    }
    if (result.documents.length > 1 || !result.meta.is_end) {
      return { status: 'unknown', reason: 'confirmation_required' };
    }
    if (result.documents.length === 0) return { status: 'unknown', reason: 'not_found' };

    const match = result.documents[0];
    if (match?.address_type === 'REGION' || match?.address_type === 'ROAD') {
      return { status: 'unknown', reason: 'confirmation_required' };
    }
    if (typeof match?.x !== 'string' || !match.x.trim() || typeof match.y !== 'string' || !match.y.trim()) {
      throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'origin_search');
    }
    const latitude = Number(match.y);
    const longitude = Number(match.x);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'origin_search');
    }
    return { status: 'ok', latitude, longitude };
  } catch (error) {
    const detail = kakaoErrorDetail(error, 'origin_search');
    return { status: 'error', message: detail.message, httpStatus: detail.httpStatus, error: detail };
  }
}
