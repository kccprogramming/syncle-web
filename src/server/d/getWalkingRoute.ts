import { fetchKakaoJson, kakaoErrorDetail, KakaoApiError } from './kakaoApiError.ts';

type Coordinates = { latitude: number; longitude: number };

export async function getWalkingRoute(origin: Coordinates, destination: Coordinates) {
  const url = new URL('https://dapi.kakao.com/v2/routing/walk');
  url.search = new URLSearchParams({
    start_x: String(origin.longitude),
    start_y: String(origin.latitude),
    end_x: String(destination.longitude),
    end_y: String(destination.latitude),
  }).toString();

  try {
    const body = await fetchKakaoJson(url, 'walking_route') as {
      status?: string;
      route?: { properties?: { totalTime: number; totalDistance: number } };
    } | null;
    const checkedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
    const noRoute = ['SAME_POINT', 'START_LINK_NOT_FOUND', 'END_LINK_NOT_FOUND', 'TOO_FAR_AWAY', 'ROUTE_RESULT_NOT_FOUND'];
    if (noRoute.includes(body?.status ?? '')) {
      return { status: 'no_route' as const, minutes: null, transferCount: null, calculationMethod: null, checkedAt };
    }
    if (body?.status === 'TOO_MANY_SEARCH_LINK') {
      throw new KakaoApiError('KAKAO_REQUEST_FAILED', 'walking_route');
    }
    const properties = body?.route?.properties;
    if (body?.status !== 'OK' || !properties ||
        !Number.isSafeInteger(properties.totalTime) || properties.totalTime < 0 ||
        !Number.isSafeInteger(properties.totalDistance) || properties.totalDistance < 0) {
      throw new KakaoApiError('KAKAO_INVALID_RESPONSE', 'walking_route');
    }
    return {
      status: 'ok' as const,
      minutes: Math.ceil(properties.totalTime / 60),
      transferCount: 0,
      calculationMethod: 'walking_route' as const,
      routeDistanceMeters: properties.totalDistance,
      checkedAt,
    };
  } catch (error) {
    return {
      status: 'error' as const, minutes: null, transferCount: null, calculationMethod: null, checkedAt: null,
      error: kakaoErrorDetail(error, 'walking_route'),
    };
  }
}
