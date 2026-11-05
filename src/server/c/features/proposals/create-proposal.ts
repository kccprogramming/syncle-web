import { calculateTimeCandidates } from '../scheduling/calculate-time-candidates.ts';
import type { ScheduleResult, TimeCandidate } from '../scheduling/types.ts';
import type { Conditions } from '../../shared/b-c-contract.ts';
export type { Conditions } from '../../shared/b-c-contract.ts';

export type Travel = {
  memberId: string;
  minutes: number | null;
  method: 'transit_api' | 'estimate' | 'unknown';
  transferCount?: number | null;
  checkedAt?: string | null;
};
export type Place = {
  id: string;
  name: string;
  address: string | null;
  url: string | null;
  travel: Travel[];
  reason: string;
  sourceDetails?: { venueConditions: string; travelTimeBasis: string; fairnessOrder: string; rank: number | null; maxTravelMinutes: number | null; travelTimeDifference: number | null; checkedAt: string };
};
export type PlaceRequest = {
  teamId: string;
  timeCandidate: TimeCandidate;
  purpose: string;
  participantCount: number;
  origins: Conditions['origins'];
  requirements: string[];
};
export type PlaceGroup = {
  timeCandidateId: string;
  status: 'found' | 'empty' | 'failed';
  places: Place[];
};
export type Proposal = {
  proposalId: string;
  teamId: string;
  status: 'draft';
  dataMode: 'example' | 'live';
  purpose: string;
  meetingMode: Conditions['meetingMode'];
  durationMinutes: number;
  agenda: string[];
  sourceMessageIds: string[];
  schedule: ScheduleResult;
  placesStatus: 'completed' | 'partial_failure' | 'failed' | 'skipped_online' | 'skipped_no_times';
  placeGroups: PlaceGroup[];
  warnings: { code: string; message: string; timeCandidateId?: string }[];
};
export type ProposalDependencies = {
  extractConditions: (teamId: string) => Promise<Conditions>;
  findPlaces: (request: PlaceRequest) => Promise<Place[]>;
};
export class ProposalError extends Error {
  code: 'INVALID_INPUT' | 'CONDITIONS_FAILED' | 'INVALID_CONDITIONS';
  constructor(code: ProposalError['code'], message: string) {
    super(message); this.name = 'ProposalError'; this.code = code;
  }
}

function validatePlaces(places: Place[], memberIds: string[]): void {
  if (!Array.isArray(places)) throw new Error('잘못된 장소 응답');
  const ids = new Set<string>();
  for (const place of places) {
    if (!place || typeof place.id !== 'string' || !place.id.trim() || ids.has(place.id) || typeof place.name !== 'string' || !place.name.trim()) throw new Error('잘못된 장소 식별자');
    ids.add(place.id);
    if (typeof place.reason !== 'string') throw new Error('잘못된 장소 설명');
    for (const value of [place.address, place.url]) if (value !== null && typeof value !== 'string') throw new Error('잘못된 장소 정보');
    if (place.url !== null) {
      const url = new URL(place.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('잘못된 장소 링크');
    }
    if (!Array.isArray(place.travel)) throw new Error('잘못된 경로 정보');
    const travelers = new Set<string>();
    for (const travel of place.travel) {
      if (!memberIds.includes(travel.memberId) || travelers.has(travel.memberId)) throw new Error('잘못된 경로 참여자');
      travelers.add(travel.memberId);
      if (!['transit_api', 'estimate', 'unknown'].includes(travel.method)) throw new Error('잘못된 경로 방식');
      if (travel.minutes !== null && (!Number.isFinite(travel.minutes) || travel.minutes < 0)) throw new Error('잘못된 이동시간');
      if (travel.method === 'unknown' && travel.minutes !== null) throw new Error('미확인 경로에 이동시간이 있음');
      if (travel.method !== 'unknown' && travel.minutes === null) throw new Error('이동시간 누락');
    }
    // 경로 누락을 0분으로 채우지 않고 명시적인 미확인 값으로 보완한다.
    for (const id of memberIds) if (!travelers.has(id)) place.travel.push({ memberId: id, minutes: null, method: 'unknown' });
  }
}

/** 저장·인증은 하지 않는다. 검증한 서버 API에서 호출하고 A의 저장 계층에 연결한다. */
export async function createProposal(
  request: { teamId: string; proposalId: string; dataMode: 'example' | 'live' },
  dependencies: ProposalDependencies,
): Promise<Proposal> {
  if (!request.teamId?.trim() || !request.proposalId?.trim() || !['example', 'live'].includes(request.dataMode)) throw new ProposalError('INVALID_INPUT', '팀 ID·제안 ID·데이터 방식을 확인해 주세요.');
  let raw: Conditions;
  try { raw = await dependencies.extractConditions(request.teamId); }
  catch { throw new ProposalError('CONDITIONS_FAILED', '조건을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  let conditions: Conditions, schedule: ScheduleResult;
  try {
    conditions = structuredClone(raw);
    if (conditions.schedule.teamId !== request.teamId || !conditions.purpose?.trim() || !['offline', 'online'].includes(conditions.meetingMode)) throw new Error('조건 불일치');
    for (const values of [conditions.agenda, conditions.sourceMessageIds, conditions.placeRequirements]) {
      if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) throw new Error('목록 형식 오류');
    }
    if (!Array.isArray(conditions.origins)) throw new Error('출발지 형식 오류');
    const members = conditions.schedule.members.map(m => m.memberId);
    const originIds = conditions.origins.map(o => o.memberId);
    if (new Set(originIds).size !== originIds.length || conditions.origins.some(o => !members.includes(o.memberId) || (o.station !== null && typeof o.station !== 'string'))) throw new Error('출발지 참여자 오류');
    schedule = calculateTimeCandidates(conditions.schedule);
  } catch { throw new ProposalError('INVALID_CONDITIONS', '추출된 조건 형식을 확인해 주세요.'); }

  const proposal: Proposal = {
    proposalId: request.proposalId, teamId: request.teamId, status: 'draft', dataMode: request.dataMode,
    purpose: conditions.purpose, meetingMode: conditions.meetingMode,
    durationMinutes: conditions.schedule.durationMinutes,
    agenda: conditions.agenda, sourceMessageIds: conditions.sourceMessageIds, schedule,
    placesStatus: conditions.meetingMode === 'online' ? 'skipped_online' : 'skipped_no_times',
    placeGroups: [], warnings: [],
  };
  if (schedule.needsConfirmation) proposal.warnings.push({ code: 'CONDITIONS_NEED_CONFIRMATION', message: '가능 시간이 미확인인 사람이 있어요. 후보별 인원을 확인해 주세요.' });
  if (conditions.meetingMode === 'online' || !schedule.candidates.length) return proposal;
  // 외부 API 호출량을 제한하기 위해 최대 3개 시간 후보를 순서대로 조회한다.
  for (const candidate of schedule.candidates) {
    try {
      const places = structuredClone(await dependencies.findPlaces({
        teamId: request.teamId, timeCandidate: structuredClone(candidate), purpose: conditions.purpose,
        participantCount: conditions.schedule.members.length,
        origins: structuredClone(conditions.origins), requirements: [...conditions.placeRequirements],
      }));
      validatePlaces(places, conditions.schedule.members.map(m => m.memberId));
      proposal.placeGroups.push({ timeCandidateId: candidate.id, status: places.length ? 'found' : 'empty', places });
      if (places.some(p => p.travel.some(t => t.minutes === null))) proposal.warnings.push({ code: 'TRAVEL_UNKNOWN', message: '일부 참여자의 이동시간을 확인하지 못했어요.', timeCandidateId: candidate.id });
    } catch {
      proposal.placeGroups.push({ timeCandidateId: candidate.id, status: 'failed', places: [] });
      proposal.warnings.push({ code: 'PLACES_FAILED', message: '이 시간의 장소 후보를 가져오지 못했어요.', timeCandidateId: candidate.id });
    }
  }
  const failures = proposal.placeGroups.filter(g => g.status === 'failed').length;
  proposal.placesStatus = !failures ? 'completed' : failures === proposal.placeGroups.length ? 'failed' : 'partial_failure';
  return proposal;
}
