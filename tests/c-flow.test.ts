import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTimeCandidates } from '../src/features/scheduling/calculate-time-candidates';
import { assertDeadlines, projectProposal, type StoredProposal } from '../src/features/scheduling/proposals';
// 지우님 de98361 테스트 — 우리 통합본은 B를 src/server/b에 두고, B 예시 출력의 placeType이 '회의 장소'라서 그 값과 비교해요
import { analyzeMessagesMock } from '../src/server/b/extractor';
import { EXAMPLE_B_INPUT, EXAMPLE_B_OUTPUT } from '../src/server/b/b-c-contract';

const startAt = '2030-11-10T19:00:00+09:00';
const endAt = '2030-11-10T20:00:00+09:00';
const slot = { startAt, endAt };
const id = `time:${startAt}/${endAt}`;

test('B example remains valid after adopting placeType', async () => {
  const result = await analyzeMessagesMock(EXAMPLE_B_INPUT);
  assert.equal(result.placeType, EXAMPLE_B_OUTPUT.placeType);
});
// 지우님 9834b43 테스트
test('all-day availability produces daytime candidates and accepts a narrower requested range', () => {
  const allDay = {
    ...structuredClone(EXAMPLE_B_OUTPUT.schedule),
    searchWindow: { startAt: '2030-11-09T00:00:00+09:00', endAt: '2030-11-10T00:00:00+09:00' },
    members: [{ memberId: 'u1', responseStatus: 'provided' as const,
      availableSlots: [{ startAt: '2030-11-09T00:00:00+09:00', endAt: '2030-11-10T00:00:00+09:00' }], unavailableSlots: [] }],
    requiredMemberIds: ['u1'], maxCandidates: 50,
  };
  const defaultResult = calculateTimeCandidates(allDay);
  assert.equal(defaultResult.candidates[0].startAt, '2030-11-09T09:00:00+09:00');
  assert.ok(defaultResult.candidates.every(c => c.endAt <= '2030-11-09T22:00:00+09:00'));
  const narrowResult = calculateTimeCandidates({ ...allDay, meetingHours: { start: '13:00', end: '15:00' } });
  assert.deepEqual(narrowResult.candidates.map(c => c.startAt), ['2030-11-09T13:00:00+09:00', '2030-11-09T14:00:00+09:00']);
  assert.throws(() => calculateTimeCandidates({ ...allDay, meetingHours: { start: '22:00', end: '09:00' } }), /회의 가능 시간/);
});
const proposal: StoredProposal = {
  id: 'proposal', teamId: 'team', ownerId: 'u1', memberIds: ['u1', 'u2'], version: 0,
  title: '회의', mode: 'online', responseDeadline: '2030-11-09T18:00:00+09:00', materialDeadline: '2030-11-10T18:00:00+09:00',
  meetingUrl: null, meeting: null, placeResults: [], progress: { step: 'times' }, responses: [],
  candidates: [{ id, ...slot, availableMemberIds: ['u1'], unavailableMemberIds: [], unknownMemberIds: ['u2'], availableCount: 1, requiredMembersSatisfied: false, needsConfirmation: true }],
  conditions: {
    purpose: '회의', meetingMode: 'online', agenda: [], sourceMessageIds: [], origins: [], placeRequirements: [], placeType: null,
    schedule: { teamId: 'team', timezone: 'Asia/Seoul', searchWindow: { startAt: '2030-11-10T18:00:00+09:00', endAt: '2030-11-10T21:00:00+09:00' }, durationMinutes: 60,
      requiredMemberIds: ['u1', 'u2'], members: [
        { memberId: 'u1', responseStatus: 'provided', availableSlots: [slot], unavailableSlots: [] },
        { memberId: 'u2', responseStatus: 'missing', availableSlots: [], unavailableSlots: [] },
      ] },
  },
};

test('C keeps a silent member unknown and does not claim a full overlap early', () => {
  const result = calculateTimeCandidates(proposal.conditions.schedule);
  assert.equal(result.candidates[0].availableCount, 1);
  assert.deepEqual(result.candidates[0].unknownMemberIds, ['u2']);
  const view = projectProposal(proposal, Date.parse('2030-11-08T00:00:00Z'));
  assert.equal(view.respondedCount, 0);
  assert.equal(view.noCommonTime, false);
  assert.deepEqual(view.pendingIds, ['u1', 'u2']);
});

test('C recalculates after the deadline using explicit responders only', () => {
  const withResponse = structuredClone(proposal);
  withResponse.responses = [{ memberId: 'u1', kind: 'selected', selectedCandidateIds: [id], customSlots: [] }];
  const view = projectProposal(withResponse, Date.parse('2030-11-10T00:00:00Z'));
  assert.equal(view.recomputeFromResponders, true);
  assert.deepEqual(view.pendingIds, ['u2']);
  assert.deepEqual(view.candidates[0].explicitAvailableMemberIds, ['u1']);
  assert.equal(view.candidates[0].availableCount, 1);
  assert.equal(view.noCommonTime, false);
  withResponse.responses.push({ memberId: 'u2', kind: 'custom', selectedCandidateIds: [], customSlots: [slot] });
  const all = projectProposal(withResponse, Date.parse('2030-11-08T00:00:00Z'));
  assert.equal(all.respondedCount, 2);
  assert.equal(all.candidates[0].availableCount, 2);
  assert.equal(all.noCommonTime, false);
  withResponse.responses[1] = { memberId: 'u2', kind: 'declined_all', selectedCandidateIds: [], customSlots: [] };
  assert.equal(projectProposal(withResponse, Date.parse('2030-11-08T00:00:00Z')).noCommonTime, true);
});

test('C requires an explicit response deadline before the material deadline', () => {
  assert.doesNotThrow(() => assertDeadlines('2030-11-09T18:00:00+09:00', '2030-11-10T18:00:00+09:00', Date.parse('2030-11-08T00:00:00Z')));
  assert.throws(() => assertDeadlines('2030-11-10T18:00:00+09:00', '2030-11-09T18:00:00+09:00', Date.parse('2030-11-08T00:00:00Z')), /응답 마감/);
});
