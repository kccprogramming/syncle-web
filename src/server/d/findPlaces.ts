import assert from 'node:assert/strict';
import { distanceMeters, kakaoKeywordPageLimit, maxSearchRadiusMeters, searchKakaoPlacePage,
  type SearchBounds } from './searchKakaoPlaces.ts';
import { resolveOrigin } from './resolveOrigin.ts';
import { getTransitRoute } from './getTransitRoute.ts';
import { getWalkingRoute } from './getWalkingRoute.ts';
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
  searchAreas?: string[];
  searchRadiusMeters?: number;
  expectedAttendeeCount?: number;
  requiredConditions?: string[];
  preferredConditions?: string[];
  excludedPlaceIds?: string[];
  members?: Member[];
};

type Coordinates = { latitude: number; longitude: number };
type SearchError = { code: string; message: string; stage?: KakaoErrorDetail['stage']; httpStatus?: number };
type Candidate = Awaited<ReturnType<typeof searchKakaoPlacePage>>['places'][number];
type AreaSearch =
  | { status: 'ok'; candidates: Candidate[] }
  | { status: 'error'; error: SearchError };
// 시연용 임시 기준. 장소 검색 반경과는 별개다.
const walkingFallbackRadiusMeters = 1500;

async function getTravelRoute(origin: Coordinates, destination: Coordinates) {
  const transit = await getTransitRoute(origin, destination);
  if (transit.status === 'no_route' && distanceMeters(origin, destination) <= walkingFallbackRadiusMeters) {
    return getWalkingRoute(origin, destination);
  }
  return transit;
}

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
  if (input.meetingMode !== 'offline' ||
      typeof input.expectedAttendeeCount !== 'number' ||
      !Number.isSafeInteger(input.expectedAttendeeCount) || input.expectedAttendeeCount < 1) return false;

  const areas = input.searchAreas;
  if (areas === undefined ? !nonempty(input.searchArea) :
    !Array.isArray(areas) || areas.length < 1 || areas.length > 3 || !areas.every(nonempty)) return false;

  const members = input.members;
  const radius = input.searchRadiusMeters;
  if (radius !== undefined && (!Number.isInteger(radius) || radius < 1 || radius > maxSearchRadiusMeters)) return false;
  return [input.requiredConditions, input.preferredConditions, input.excludedPlaceIds].every(
    (conditions) => conditions === undefined || (Array.isArray(conditions) && conditions.every(nonempty)),
  ) && (members === undefined || (Array.isArray(members) &&
    members.every((member) => member && nonempty(member.memberId) &&
      (member.origin === undefined || nonempty(member.origin))) &&
    new Set(members.map(({ memberId }) => memberId)).size === members.length));
}

function validCoordinates({ latitude, longitude }: Coordinates): boolean {
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

async function resolveSearchArea(area: string): ReturnType<typeof resolveOrigin> {
  const resolved = await resolveOrigin(area, { stationArea: true });
  if (resolved.status !== 'unknown' || resolved.reason !== 'not_found' || /역(?:\s+(?:\S+선|공항철도|GTX-[A-Z]))?$/.test(area)) {
    return resolved;
  }

  // 학교 같은 지명은 주소 검색에서 찾지 못할 수 있다. 이름이 정확하고 유일한 경우에만 사용한다.
  let center: Coordinates | undefined;
  for (let page = 1; page <= kakaoKeywordPageLimit; page++) {
    const { places, isEnd } = await searchKakaoPlacePage(area, page);
    for (const place of places) {
      if (place.name !== area) continue;
      if (center || !validCoordinates(place)) return { status: 'unknown', reason: 'confirmation_required' };
      center = { latitude: place.latitude, longitude: place.longitude };
    }
    if (isEnd) break;
  }
  return center ? { status: 'ok', ...center } : resolved;
}

async function searchCandidates(query: string, excludedPlaceIds: readonly string[], bounds: SearchBounds) {
  const seen = new Set(excludedPlaceIds);
  const candidates: Awaited<ReturnType<typeof searchKakaoPlacePage>>['places'] = [];
  for (let page = 1; page <= kakaoKeywordPageLimit; page++) {
    const { places, isEnd } = await searchKakaoPlacePage(query, page, bounds);
    for (const place of places) {
      if (seen.has(place.placeId) || !validCoordinates(place) || distanceMeters(bounds, place) > bounds.radiusMeters) continue;
      seen.add(place.placeId);
      candidates.push(place);
      if (candidates.length === 2) return candidates;
    }
    if (isEnd) break;
  }
  return candidates;
}

function failure(code: string, message: string, detail?: SearchError) {
  return { status: 'error' as const, dataSource: null, places: [], error: detail ?? { code, message } };
}

async function searchAreaCandidates(input: Request, area: string): Promise<AreaSearch> {
  try {
    const center = await resolveSearchArea(area);
    if (center.status === 'error' && center.error) return { status: 'error', error: center.error };
    if (center.status !== 'ok' || !validCoordinates(center)) {
      return { status: 'error', error: {
        code: 'SEARCH_AREA_UNRESOLVED',
        message: '검색 지역을 확인할 수 없습니다. 정확한 주소나 역 이름을 입력해 주세요.',
      } };
    }
    const bounds = { latitude: center.latitude, longitude: center.longitude, radiusMeters: input.searchRadiusMeters ?? 1500 };
    return { status: 'ok', candidates: await searchCandidates(input.meetingPurpose.trim(), input.excludedPlaceIds ?? [], bounds) };
  } catch (error) {
    return { status: 'error', error: error instanceof KakaoApiError
      ? error.detail
      : { code: 'PLACE_SEARCH_FAILED', message: '장소 검색에 실패했습니다.' } };
  }
}

function unresolved(memberId: string, status: 'unknown' | 'error', checkedAt: string | null = null, error?: KakaoErrorDetail) {
  return { memberId, status, minutes: null, transferCount: null, calculationMethod: null, checkedAt, ...(error ? { error } : {}) };
}

async function collectPreview(
  input: Request,
  candidates: (Candidate & { matchedSearchAreas?: string[] })[],
  maxTravelMinutesLimit?: number,
) {
  const checkedAt = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
  const origins = new Map<string, Awaited<ReturnType<typeof resolveOrigin>>>();
  const routes = new Map<string, Awaited<ReturnType<typeof getTravelRoute>>>();
  const places = [];
  for (const candidate of candidates) {
    const { placeId, name, address, detailUrl, latitude, longitude, matchedSearchAreas } = candidate;
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
        route = await getTravelRoute(from, coordinates);
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
      ...(matchedSearchAreas ? { matchedSearchAreas } : {}),
    });
  }
  return rankPlacesByFairness(places, maxTravelMinutesLimit).map(({ matchedPreferredConditionCount, ...place }) => place);
}

export async function findPlaces(input: Request, options: { previewUnverified?: boolean; maxTravelMinutesLimit?: number } = {}) {
  if (!validRequest(input)) return failure('INVALID_INPUT', '필수 입력과 형식을 확인해 주세요.');
  const { teamId, proposalId, timeOptionId } = input;
  const ids = { teamId, proposalId, timeOptionId };
  if (input.meetingMode === 'online') {
    return { ...ids, status: 'skipped' as const, dataSource: null, places: [] };
  }
  const { maxTravelMinutesLimit } = options;
  if (maxTravelMinutesLimit !== undefined && (!Number.isSafeInteger(maxTravelMinutesLimit) || maxTravelMinutesLimit < 0)) {
    return failure('INVALID_INPUT', '최대 이동시간 제한은 0 이상의 정수여야 합니다.');
  }
  if (input.dataMode === 'mock') {
    return failure('UNSUPPORTED_DATA_MODE', '오프라인 mock 데이터는 아직 제공되지 않습니다.');
  }

  const multiArea = input.searchAreas !== undefined;
  const areas = new Set((input.searchAreas ?? [input.searchArea!]).map(
    (area) => area.trim().replace(/\s+/g, ' ').replace(/\s+인근$/, ''),
  ));
  const candidates = new Map<string, Candidate & { matchedSearchAreas?: string[] }>();
  const areaResults: ({ searchArea: string } & (
    | { status: 'ok' | 'empty'; candidateCount: number }
    | { status: 'error'; error: SearchError }
  ))[] = [];
  for (const area of areas) {
    const result = await searchAreaCandidates(input, area);
    if (result.status === 'error') {
      if (!multiArea) return failure(result.error.code, result.error.message, result.error);
      areaResults.push({ searchArea: area, status: 'error', error: result.error });
      continue;
    }
    areaResults.push({ searchArea: area, status: result.candidates.length ? 'ok' : 'empty',
      candidateCount: result.candidates.length });
    for (const place of result.candidates) {
      const existing = candidates.get(place.placeId);
      if (existing) {
        existing.matchedSearchAreas?.push(area);
      } else {
        candidates.set(place.placeId, multiArea ? { ...place, matchedSearchAreas: [area] } : place);
      }
    }
  }

  if (multiArea && areaResults.every((area) => area.status === 'error')) {
    return { ...failure('ALL_SEARCH_AREAS_FAILED', '모든 검색 지역에서 장소 검색을 완료하지 못했습니다.'), areaResults };
  }
  const response = { ...ids, status: 'ok' as const, dataSource: 'api' as const, places: [],
    ...(multiArea ? { areaResults } : {}) };
  if (candidates.size === 0) return response;
  // 현재 API는 수용 인원과 필수 조건의 충족 여부를 확인할 수 없다.
  if (!options.previewUnverified) return response;
  const places = await collectPreview(input, [...candidates.values()], maxTravelMinutesLimit);
  if (multiArea) {
    places.sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER));
  }
  return {
    ...response,
    places,
    preview: {
      venueConditions: 'unverified',
      travelTimeBasis: 'api_estimate_without_meeting_time',
    },
  };
}
