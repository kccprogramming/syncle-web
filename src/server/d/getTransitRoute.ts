import { fetchKakaoJson, kakaoErrorDetail, KakaoApiError, type KakaoErrorDetail } from './kakaoApiError.ts';

type Coordinates = { latitude: number; longitude: number };
type TransitResult =
  | { status: 'ok'; minutes: number; transferCount: number; calculationMethod: 'transit_route'; checkedAt: string }
  | { status: 'no_route'; minutes: null; transferCount: null; calculationMethod: null; checkedAt: string }
  | { status: 'error'; minutes: null; transferCount: null; calculationMethod: null; checkedAt: null; message: string; error?: KakaoErrorDetail };

function failure(message: string, error?: KakaoErrorDetail): TransitResult {
  return { status: 'error', minutes: null, transferCount: null, calculationMethod: null, checkedAt: null, message, ...(error ? { error } : {}) };
}

export async function getTransitRoute(origin: Coordinates, destination: Coordinates): Promise<TransitResult> {
  for (const { latitude, longitude } of [origin, destination]) {
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
        !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      return failure('출발지와 도착지의 위도·경도를 확인해 주세요.');
    }
  }

  const url = new URL('https://dapi.kakao.com/v2/routing/publictraffic');
  url.search = new URLSearchParams({
    start_x: String(origin.longitude),
    start_y: String(origin.latitude),
    end_x: String(destination.longitude),
    end_y: String(destination.latitude),
  }).toString();

  try {
    const body = await fetchKakaoJson(url, 'transit_route') as {
      status?: string;
      routes?: Array<{ properties?: { totalTime: number; transfers: number } }>;
    } | null;
    const checkedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
    const noRouteStatuses = ['NO_RESULTS', 'STARTNODES_NULL', 'ENDNODES_NULL', 'EQUAL_POINTS'];
    if (noRouteStatuses.includes(body?.status ?? '') ||
        (body?.status === 'OK' && Array.isArray(body.routes) && body.routes.length === 0)) {
      return { status: 'no_route', minutes: null, transferCount: null, calculationMethod: null, checkedAt };
    }
    if (body?.status === 'INVALID_REQUEST') throw new KakaoApiError('KAKAO_REQUEST_FAILED', 'transit_route');
    if (body?.status !== 'OK' || !Array.isArray(body.routes)) {
      throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'transit_route');
    }

    let fastest: { totalTime: number; transfers: number } | undefined;
    for (const route of body.routes) {
      const properties = route?.properties;
      if (!properties || !Number.isSafeInteger(properties.totalTime) || properties.totalTime < 0 ||
          !Number.isSafeInteger(properties.transfers) || properties.transfers < 0) {
        throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'transit_route');
      }
      if (!fastest || properties.totalTime < fastest.totalTime) fastest = properties;
    }
    if (!fastest) throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'transit_route');

    return {
      status: 'ok',
      minutes: Math.round(fastest.totalTime / 60),
      transferCount: fastest.transfers,
      calculationMethod: 'transit_route',
      checkedAt,
    };
  } catch (error) {
    const detail = kakaoErrorDetail(error, 'transit_route');
    return failure(detail.message, detail);
  }
}
