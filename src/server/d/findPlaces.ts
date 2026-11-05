import { kakaoKeywordPageLimit, searchKakaoPlacePage, searchKakaoPlaces } from './searchKakaoPlaces.ts';
import { resolveOrigin } from './resolveOrigin.ts';
import { getTransitRoute } from './getTransitRoute.ts';
import { rankPlacesByFairness } from './rankPlacesByFairness.ts';
import { KakaoApiError, type KakaoErrorDetail } from './kakaoApiError.ts';

type Member = { memberId: string; origin?: string };
type Request = {
  teamId: string;
  proposalId: string;
  timeOptionId: string;
  meetingPurpose: string;
  startAt: string;
  endAt: string;
  meetingMode: 'online' | 'offline';
  dataMode: 'api' | 'mock';
  searchArea?: string;
  expectedAttendeeCount?: number;
  requiredConditions?: string[];
  preferredConditions?: string[];
  excludedPlaceIds?: string[];
  members?: Member[];
};

type Coordinates = { latitude: number; longitude: number };

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function seoulTime(value: unknown): value is string {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?\+09:00$/.test(value)) return false;
  const local = new Date(value.replace('+09:00', 'Z'));
  return Number.isFinite(local.getTime()) && local.toISOString().slice(0, 19) === value.slice(0, 19);
}

function validRequest(input: Request): boolean {
  if (!input || ![input.teamId, input.proposalId, input.timeOptionId, input.meetingPurpose].every(nonempty) ||
      !seoulTime(input.startAt) || !seoulTime(input.endAt) || Date.parse(input.endAt) <= Date.parse(input.startAt) ||
      !['api', 'mock'].includes(input.dataMode)) return false;
  if (input.meetingMode === 'online') return true;
  if (input.meetingMode !== 'offline' || !nonempty(input.searchArea) ||
      typeof input.expectedAttendeeCount !== 'number' ||
      !Number.isSafeInteger(input.expectedAttendeeCount) || input.expectedAttendeeCount < 1) return false;

  const members = input.members;
  return [input.requiredConditions, input.preferredConditions, input.excludedPlaceIds].every(
    (conditions) => conditions === undefined || (Array.isArray(conditions) && conditions.every(nonempty)),
  ) && (members === undefined || (Array.isArray(members) &&
    members.every((member) => member && nonempty(member.memberId) &&
      (member.origin === undefined || nonempty(member.origin))) &&
    new Set(members.map(({ memberId }) => memberId)).size === members.length));
}

async function searchCandidates(query: string, excludedPlaceIds: readonly string[]) {
  const seen = new Set(excludedPlaceIds);
  const candidates: Awaited<ReturnType<typeof searchKakaoPlaces>> = [];
  const usePagination = excludedPlaceIds.length > 0;
  const maxPages = usePagination ? kakaoKeywordPageLimit : 1;
  for (let page = 1; page <= maxPages; page++) {
    const { places, isEnd } = await searchKakaoPlacePage(query, usePagination ? page : undefined);
    for (const place of places) {
      if (seen.has(place.placeId)) continue;
      seen.add(place.placeId);
      candidates.push(place);
      if (candidates.length === 2) return candidates;
    }
    if (isEnd) break;
  }
  return candidates;
}

function failure(code: string, message: string, detail?: KakaoErrorDetail) {
  return { status: 'error' as const, dataSource: null, places: [], error: detail ?? { code, message } };
}

function unresolved(memberId: string, status: 'unknown' | 'error', checkedAt: string | null = null, error?: KakaoErrorDetail) {
  return { memberId, status, minutes: null, transferCount: null, calculationMethod: null, checkedAt, ...(error ? { error } : {}) };
}

async function collectPreview(input: Request, candidates: Awaited<ReturnType<typeof searchKakaoPlaces>>) {
  const checkedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
  const origins = new Map<string, Awaited<ReturnType<typeof resolveOrigin>>>();
  const routes = new Map<string, Awaited<ReturnType<typeof getTransitRoute>>>();
  const places = [];
  for (const candidate of candidates) {
    const { placeId, name, address, detailUrl, latitude, longitude } = candidate;
    const coordinates: Coordinates | undefined =
      Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
      Number.isFinite(longitude) && Math.abs(longitude) <= 180 &&
      latitude !== 0 && longitude !== 0 ? { latitude, longitude } : undefined;
    const travelTimes = [];
    for (const { memberId, origin } of input.members ?? []) {
      if (!origin || !coordinates) {
        travelTimes.push(unresolved(memberId, 'unknown'));
        continue;
      }
      const key = origin.trim().replace(/\s+/g, ' ');
      let from = origins.get(key);
      if (!from) {
        from = await resolveOrigin(key);
        origins.set(key, from);
      }
      if (from.status !== 'ok') {
        travelTimes.push(unresolved(memberId, from.status, null, from.status === 'error' ? from.error : undefined));
        continue;
      }
      const routeKey = JSON.stringify([from.latitude, from.longitude, latitude, longitude]);
      let route = routes.get(routeKey);
      if (!route) {
        route = await getTransitRoute(from, coordinates);
        routes.set(routeKey, route);
      }
      travelTimes.push(route.status === 'ok'
        ? { memberId, ...route }
        : unresolved(memberId, route.status === 'no_route' ? 'unknown' : 'error', route.checkedAt,
          route.status === 'error' ? route.error : undefined));
    }
    places.push({
      placeId, name, checkedAt, travelTimes, matchedPreferredConditionCount: 0,
      ...(nonempty(address) ? { address } : {}),
      ...(nonempty(detailUrl) ? { detailUrl } : {}),
      ...(coordinates ? { coordinates } : {}),
    });
  }
  return rankPlacesByFairness(places).map(({ matchedPreferredConditionCount, ...place }) => place);
}

export async function findPlaces(input: Request, options: { previewUnverified?: boolean } = {}) {
  if (!validRequest(input)) return failure('INVALID_INPUT', '필수 입력과 형식을 확인해 주세요.');
  const { teamId, proposalId, timeOptionId } = input;
  const ids = { teamId, proposalId, timeOptionId };
  if (input.meetingMode === 'online') {
    return { ...ids, status: 'skipped' as const, dataSource: null, places: [] };
  }
  if (input.dataMode === 'mock') {
    return failure('UNSUPPORTED_DATA_MODE', '오프라인 mock 데이터는 아직 제공되지 않습니다.');
  }

  let candidates;
  try {
    const query = [input.searchArea?.trim(), input.meetingPurpose.trim()].join(' ');
    candidates = await searchCandidates(query, input.excludedPlaceIds ?? []);
  } catch (error) {
    if (error instanceof KakaoApiError) return failure(error.detail.code, error.detail.message, error.detail);
    return failure('PLACE_SEARCH_FAILED', '장소 검색에 실패했습니다.');
  }

  const response = { ...ids, status: 'ok' as const, dataSource: 'api' as const, places: [] };
  if (candidates.length === 0) return response;
  // 현재 API는 수용 인원과 필수 조건의 충족 여부를 확인할 수 없다.
  if (!options.previewUnverified) return response;
  const places = await collectPreview(input, candidates);
  return {
    ...response,
    places,
    preview: {
      venueConditions: 'unverified',
      travelTimeBasis: 'api_estimate_without_meeting_time',
    },
  };
}
