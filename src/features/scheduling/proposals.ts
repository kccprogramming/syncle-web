import type { Conditions, Slot } from '../../server/b/b-c-contract';
import { calculateTimeCandidates } from './calculate-time-candidates';

export type ResponseKind = 'selected' | 'declined_all' | 'custom';
export type SavedResponse = { memberId: string; kind: ResponseKind; selectedCandidateIds: string[]; customSlots: Slot[] };
export type PlaceResult = { timeOptionId: string; status: 'ok' | 'error'; searchAreas?: string[]; travelLimitMinutes?: number; places: { id: string; name: string; area?: string; url: string | null; rank: number | null; maxTravelMinutes?: number | null; travelTimeDifference?: number | null; travel: { memberId: string; minutes: number | null; status: string }[]; reason: string }[]; error?: { code: string; message: string }; checkedAt: string };
export type StoredProposal = {
  id: string; teamId: string; ownerId: string; memberIds: string[]; version: number;
  title: string; mode: 'online' | 'offline'; conditions: Conditions;
  candidates: ReturnType<typeof calculateTimeCandidates>['candidates']; responses: SavedResponse[];
  responseDeadline: string; materialDeadline: string; meetingUrl: string | null;
  progress: { step: 'reading' | 'times' | 'places' | 'done' | 'partial-fail'; error?: string };
  placeResults: PlaceResult[];
  meeting: null | { id: string; startAt: string; endAt: string; attendeeIds: string[]; mode: 'online' | 'offline'; meetingUrl: string | null; place: { id: string; name: string; url: string | null } | null };
};

export class ScheduleError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function assertDeadlines(responseDeadline: string, materialDeadline: string, now = Date.now()) {
  const response = Date.parse(responseDeadline), material = Date.parse(materialDeadline);
  const explicit = /(?:Z|[+-]\d{2}:\d{2})$/;
  if (!explicit.test(responseDeadline) || !explicit.test(materialDeadline) || !Number.isFinite(response) || !Number.isFinite(material) || response <= now || response >= material) {
    throw new ScheduleError('INVALID_DEADLINE', '응답 마감은 현재보다 뒤이고 자료 마감보다 앞이어야 해요.');
  }
}
function contains(outer: Slot, inner: Slot) { return Date.parse(outer.startAt) <= Date.parse(inner.startAt) && Date.parse(outer.endAt) >= Date.parse(inner.endAt); }
export function respondsAvailable(proposal: StoredProposal, response: SavedResponse, slot: Slot) {
  if (response.kind === 'declined_all') return false;
  const slots = response.kind === 'custom' ? response.customSlots : proposal.candidates.filter(c => response.selectedCandidateIds.includes(c.id));
  return slots.some(s => contains(s, slot));
}

/** Pure projection. Missing responses are never converted into confirmed availability. */
export function projectProposal(proposal: StoredProposal, now = Date.now()) {
  const responses = new Map(proposal.responses.map(r => [r.memberId, r]));
  const pendingIds = proposal.memberIds.filter(id => !responses.has(id));
  const recomputeFromResponders = pendingIds.length === 0 || now >= Date.parse(proposal.responseDeadline);
  const schedule = structuredClone(proposal.conditions.schedule);
  schedule.requiredMemberIds = recomputeFromResponders ? schedule.requiredMemberIds.filter(id => responses.has(id)) : schedule.requiredMemberIds;
  schedule.members = schedule.members.map(member => {
    const response = responses.get(member.memberId);
    if (response) {
      const availableSlots = response.kind === 'custom' ? response.customSlots : response.kind === 'selected' ? proposal.candidates.filter(c => response.selectedCandidateIds.includes(c.id)).map(({ startAt, endAt }) => ({ startAt, endAt })) : [];
      return { ...member, responseStatus: 'provided' as const, availableSlots, unavailableSlots: response.kind === 'declined_all' ? [schedule.searchWindow] : [] };
    }
    return recomputeFromResponders ? { ...member, responseStatus: 'missing' as const, availableSlots: [], unavailableSlots: [] } : member;
  });
  const computed = calculateTimeCandidates(schedule);
  const candidates = computed.candidates.map(candidate => ({ ...candidate,
    explicitAvailableMemberIds: proposal.responses.filter(r => respondsAvailable(proposal, r, candidate)).map(r => r.memberId),
  }));
  return { ...proposal, candidates, pendingIds, respondedCount: responses.size, totalCount: proposal.memberIds.length,
    recomputeFromResponders, status: proposal.meeting ? 'confirmed' as const : 'collecting' as const,
    noCommonTime: recomputeFromResponders && !candidates.some(c => c.requiredMembersSatisfied && c.availableCount === responses.size),
    meeting: proposal.meeting,
  };
}
