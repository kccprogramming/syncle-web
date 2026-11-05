import type { Place, Proposal } from './create-proposal.ts';

export type Vote = {
  memberId: string;
  timeCandidateIds: string[];
  placeSelections: { timeCandidateId: string; placeId: string }[];
};
export type Meeting = {
  meetingId: string; proposalId: string; teamId: string;
  purpose: string; meetingMode: 'offline' | 'online';
  startAt: string; endAt: string; timeCandidateId: string;
  place: Place | null; agenda: string[]; attendeeIds: string[];
  absentMemberIds: string[]; confirmedBy: string; confirmedAt: string;
  dataMode: 'example' | 'live';
};
export type ProposalFlow = {
  proposal: Proposal;
  memberIds: string[];
  leaderId: string;
  status: 'draft' | 'confirmed';
  votes: Vote[];
  meeting: Meeting | null;
};
export class FlowError extends Error {
  code: 'INVALID_INPUT' | 'FORBIDDEN' | 'INVALID_SELECTION' | 'ALREADY_CONFIRMED' | 'NEEDS_CONFIRMATION';
  constructor(code: FlowError['code'], message: string) { super(message); this.name = 'FlowError'; this.code = code; }
}

/** memberIds·leaderId와 호출자는 향후 A의 서버 인증·DB에서 가져와야 한다. */
export function startProposalFlow(proposal: Proposal, team: { memberIds: string[]; leaderId: string }): ProposalFlow {
  if (!team.memberIds.length || team.memberIds.some(id => !id.trim()) || new Set(team.memberIds).size !== team.memberIds.length || !team.memberIds.includes(team.leaderId)) throw new FlowError('INVALID_INPUT', '팀원과 리더 정보를 확인해 주세요.');
  for (const candidate of proposal.schedule.candidates) {
    const ids = [...candidate.availableMemberIds, ...candidate.unavailableMemberIds, ...candidate.unknownMemberIds];
    if (new Set(ids).size !== ids.length || ids.length !== team.memberIds.length || ids.some(id => !team.memberIds.includes(id))) throw new FlowError('INVALID_INPUT', '제안의 참여자와 팀원 목록이 다릅니다.');
  }
  return { proposal: structuredClone(proposal), ...structuredClone(team), status: 'draft', votes: [], meeting: null };
}
function assertMember(state: ProposalFlow, actorId: string): void {
  if (!state.memberIds.includes(actorId)) throw new FlowError('FORBIDDEN', '이 팀의 구성원만 사용할 수 있어요.');
}
function candidate(state: ProposalFlow, id: string) {
  const result = state.proposal.schedule.candidates.find(c => c.id === id);
  if (!result) throw new FlowError('INVALID_SELECTION', '이 제안의 시간 후보를 선택해 주세요.');
  return result;
}
function place(state: ProposalFlow, timeId: string, placeId: string): Place {
  const result = state.proposal.placeGroups.find(g => g.timeCandidateId === timeId && g.status === 'found')?.places.find(p => p.id === placeId);
  if (!result) throw new FlowError('INVALID_SELECTION', '선택한 시간에 연결된 장소를 선택해 주세요.');
  return result;
}

/** 복수 선택 가능. 새 요청은 본인의 기존 선택을 교체하며 빈 목록은 투표 취소다. */
export function castVote(state: ProposalFlow, actorId: string, selection: Omit<Vote, 'memberId'>): ProposalFlow {
  assertMember(state, actorId);
  if (state.status === 'confirmed') throw new FlowError('ALREADY_CONFIRMED', '확정된 제안에는 투표할 수 없어요.');
  if (new Set(selection.timeCandidateIds).size !== selection.timeCandidateIds.length) throw new FlowError('INVALID_SELECTION', '시간 후보를 중복 선택할 수 없어요.');
  selection.timeCandidateIds.forEach(id => candidate(state, id));
  const pairs = new Set<string>();
  for (const selected of selection.placeSelections) {
    if (state.proposal.meetingMode === 'online' || !selection.timeCandidateIds.includes(selected.timeCandidateId)) throw new FlowError('INVALID_SELECTION', '투표한 대면 시간 후보의 장소만 선택할 수 있어요.');
    place(state, selected.timeCandidateId, selected.placeId);
    const key = JSON.stringify([selected.timeCandidateId, selected.placeId]);
    if (pairs.has(key)) throw new FlowError('INVALID_SELECTION', '장소 후보를 중복 선택할 수 없어요.');
    pairs.add(key);
  }
  const next = structuredClone(state);
  next.votes = next.votes.filter(v => v.memberId !== actorId);
  if (selection.timeCandidateIds.length) next.votes.push({ memberId: actorId, ...structuredClone(selection) });
  return next;
}

export function voteSummary(state: ProposalFlow) {
  return {
    votedMemberCount: state.votes.length,
    totalMemberCount: state.memberIds.length,
    totalTimeSelections: state.votes.reduce((sum, v) => sum + v.timeCandidateIds.length, 0),
    timeOptions: state.proposal.schedule.candidates.map(c => ({
      timeCandidateId: c.id, votes: state.votes.filter(v => v.timeCandidateIds.includes(c.id)).length,
    })),
    placeOptions: state.proposal.placeGroups.flatMap(g => g.places.map(p => ({
      timeCandidateId: g.timeCandidateId, placeId: p.id,
      votes: state.votes.filter(v => v.placeSelections.some(s => s.timeCandidateId === g.timeCandidateId && s.placeId === p.id)).length,
    }))),
  };
}

export type ConfirmSelection = {
  timeCandidateId: string; placeId: string | null; meetingId: string; confirmedAt: string;
  acknowledgePartialAttendance?: boolean;
};
/** 저장된 최신 상태에 적용한다. DB 연결 시 트랜잭션과 proposalId의 유일성 제약이 필요하다. */
export function confirmProposal(state: ProposalFlow, actorId: string, selection: ConfirmSelection): ProposalFlow {
  assertMember(state, actorId);
  if (actorId !== state.leaderId) throw new FlowError('FORBIDDEN', '리더만 회의를 확정할 수 있어요.');
  if (state.status === 'confirmed') {
    if (state.meeting?.timeCandidateId === selection.timeCandidateId && state.meeting.place?.id === (selection.placeId ?? undefined)) return structuredClone(state);
    throw new FlowError('ALREADY_CONFIRMED', '이미 다른 선택으로 확정된 제안이에요.');
  }
  if (!selection.meetingId?.trim() || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(selection.confirmedAt) || !Number.isFinite(Date.parse(selection.confirmedAt))) throw new FlowError('INVALID_INPUT', '회의 ID와 확정 시각을 확인해 주세요.');
  const time = candidate(state, selection.timeCandidateId);
  if (!time.requiredMembersSatisfied || time.unknownMemberIds.length) throw new FlowError('NEEDS_CONFIRMATION', '필수 참석자의 가능 여부와 미확인 시간을 먼저 확인해 주세요.');
  if (time.unavailableMemberIds.length && !selection.acknowledgePartialAttendance) throw new FlowError('NEEDS_CONFIRMATION', '불참자가 있는 회의임을 확인해 주세요.');
  let selectedPlace: Place | null = null;
  if (state.proposal.meetingMode === 'online') {
    if (selection.placeId !== null) throw new FlowError('INVALID_SELECTION', '온라인 회의에는 장소를 선택하지 않아요.');
  } else {
    if (!selection.placeId) throw new FlowError('INVALID_SELECTION', '대면 회의의 장소를 선택해 주세요.');
    selectedPlace = place(state, time.id, selection.placeId);
  }
  const next = structuredClone(state);
  next.status = 'confirmed';
  next.meeting = {
    meetingId: selection.meetingId, proposalId: state.proposal.proposalId, teamId: state.proposal.teamId,
    purpose: state.proposal.purpose, meetingMode: state.proposal.meetingMode,
    startAt: time.startAt, endAt: time.endAt, timeCandidateId: time.id,
    place: structuredClone(selectedPlace), agenda: [...state.proposal.agenda],
    attendeeIds: [...time.availableMemberIds], absentMemberIds: [...time.unavailableMemberIds],
    confirmedBy: actorId, confirmedAt: selection.confirmedAt, dataMode: state.proposal.dataMode,
  };
  return next;
}

/** 홈 표시용. 진행 중인 회의도 포함하고, 끝난 회의는 제외한다. */
export function upcomingMeetings(meetings: Meeting[], teamIds: string[], now: string): Meeting[] {
  const timestamp = Date.parse(now);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(now) || !Number.isFinite(timestamp)) throw new FlowError('INVALID_INPUT', '시간대가 있는 기준 시각이 필요해요.');
  return structuredClone(meetings.filter(m => teamIds.includes(m.teamId) && Date.parse(m.endAt) > timestamp)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)));
}
