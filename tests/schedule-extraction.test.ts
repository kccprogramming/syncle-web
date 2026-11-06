import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMessages, validateConditions } from '../src/server/b/extractor';
import { EXAMPLE_B_INPUT, EXAMPLE_B_OUTPUT } from '../src/server/b/b-c-contract';
import { scheduleTimeRules } from '../src/server/b/schedule-time-rules';
import { normalizeScheduleOutput, scheduleTimeSummary } from '../src/server/normalize-schedule-output';
import { calculateTimeCandidates } from '../src/features/scheduling/calculate-time-candidates';

const slot = (day: number, start: string, end: string, endDay = day) => ({
  startAt: `2026-11-${String(day).padStart(2, '0')}T${start}:00+09:00`, endAt: `2026-11-${String(endDay).padStart(2, '0')}T${end}:00+09:00`,
});

test('explicit clock times survive B validation and normalizing; only conflicts are subtracted', () => {
  const input = structuredClone(EXAMPLE_B_INPUT), result = structuredClone(EXAMPLE_B_OUTPUT);
  result.schedule.members[0].availableSlots = [slot(10, '17:00', '23:00')];
  result.schedule.members[0].unavailableSlots = [slot(10, '18:00', '22:00')];
  const normalized = normalizeScheduleOutput(result);
  const checked = validateConditions(normalized, input);
  assert.deepEqual(checked.schedule.members[0].unavailableSlots, [slot(10, '18:00', '22:00')]);
  assert.deepEqual(checked.schedule.members[0].availableSlots, [slot(10, '17:00', '18:00'), slot(10, '22:00', '23:00')]);
  assert.equal(scheduleTimeSummary(normalized)[0].available.minutes, 120);
});

test('Thursday and explicit remaining-day availability reach C from a controlled B response', async () => {
  const input = structuredClone(EXAMPLE_B_INPUT);
  input.referenceDate = '2026-11-06';
  input.members = ['u1', 'u2', 'u3', 'u4'].map(memberId => ({ memberId, name: memberId, station: null }));
  input.requiredMemberIds = input.members.map(m => m.memberId);
  input.messages = [
    ['u1', '목요일 공강이라 하루종일 가능해요. 월,수 18시부터 22시까지 알바가 있어요.'],
    ['u2', '수업은 목요일 2시에 끝나고 나머지는 5시에 끝나요.'],
    ['u3', '월화수 풀타임 알바라 어렵고 나머지는 전부 가능합니다.'],
    ['u4', '화목은 오전에 끝나고 월수금은 6시요.'],
  ].map(([senderId, text], index) => ({ id: `m${index}`, senderId, text, sentAt: '2026-11-06T18:00:00+09:00' }));
  const fixture = structuredClone(EXAMPLE_B_OUTPUT);
  fixture.schedule.requiredMemberIds = input.requiredMemberIds;
  fixture.schedule.durationMinutes = 90;
  fixture.schedule.members = [
    { memberId: 'u1', responseStatus: 'provided', availableSlots: [slot(12, '00:00', '00:00', 13)], unavailableSlots: [slot(9, '18:00', '22:00'), slot(11, '18:00', '22:00')] },
    { memberId: 'u2', responseStatus: 'needs_confirmation', availableSlots: [], unavailableSlots: [] },
    { memberId: 'u3', responseStatus: 'provided', availableSlots: [12, 13, 14, 15].map(d => slot(d, '00:00', '00:00', d + 1)), unavailableSlots: [9, 10, 11].map(d => slot(d, '00:00', '00:00', d + 1)) },
    { memberId: 'u4', responseStatus: 'needs_confirmation', availableSlots: [], unavailableSlots: [] },
  ];
  fixture.origins = input.members.map(m => ({ memberId: m.memberId, station: null }));
  fixture.sourceMessageIds = input.messages.map(m => m.id);
  // Controlled output tests the application pipeline, not a live model's comprehension.
  const output = await analyzeMessages(input, async () => JSON.stringify(normalizeScheduleOutput(fixture)));
  assert.deepEqual(output.schedule.members[0].unavailableSlots, fixture.schedule.members[0].unavailableSlots);
  const candidates = calculateTimeCandidates(output.schedule).candidates;
  assert.ok(candidates.length > 0);
  assert.equal(candidates[0].startAt, '2026-11-12T09:00:00+09:00');
  assert.equal(candidates[0].availableCount, 2);
  assert.deepEqual(candidates[0].unknownMemberIds, ['u2', 'u4']);
});

test('prompt calendar maps the search week to Seoul weekdays and excludes the end day', () => {
  const rules = scheduleTimeRules(EXAMPLE_B_INPUT);
  assert.ok(rules.includes('2026-11-09(월)'));
  assert.ok(rules.includes('2026-11-12(목)'));
  assert.ok(!rules.includes('2026-11-16(월)'));
});

test('normalization diagnostics contain counts, not private origins or IDs', () => {
  const value = structuredClone(EXAMPLE_B_OUTPUT);
  value.origins[0].station = '비공개 주소';
  const diagnostic = JSON.stringify(scheduleTimeSummary(value));
  assert.equal(diagnostic.includes('비공개'), false);
  assert.equal(diagnostic.includes('memberId'), false);
});
