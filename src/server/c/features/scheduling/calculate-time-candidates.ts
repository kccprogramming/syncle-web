import type { ScheduleInput, ScheduleResult, Slot, TimeCandidate } from './types.ts';

type Range = [number, number];
const MINUTE = 60_000;

function range(slot: Slot): Range {
  // 시간대 누락이나 존재하지 않는 날짜를 Date.parse가 자동 보정하지 못하게 검사한다.
  const parse = (value: string): number => {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):00\+09:00$/.exec(value);
    if (!match) throw new Error('날짜는 초가 00인 ISO 형식과 +09:00 시간대를 사용해 주세요.');
    const ms = Date.parse(value);
    if (!Number.isFinite(ms) || new Date(ms + 9 * 60 * MINUTE).toISOString().slice(0, 16) !== `${match[1]}T${match[2]}`) {
      throw new Error('존재하는 날짜와 시간을 입력해 주세요.');
    }
    return ms;
  };
  const start = parse(slot.startAt), end = parse(slot.endAt);
  if (end <= start) throw new Error('종료 시각은 시작 시각보다 뒤여야 합니다.');
  return [start, end];
}

function merge(ranges: Range[]): Range[] {
  const result: Range[] = [];
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
    const last = result.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else result.push([start, end]);
  }
  return result;
}
function koreanTime(ms: number): string {
  return new Date(ms + 9 * 60 * MINUTE).toISOString().slice(0, 19) + '+09:00';
}

/** AI·DB·외부 API를 호출하지 않는 순수 시간 계산 함수. 입력 배열도 변경하지 않는다. */
export function calculateTimeCandidates(input: ScheduleInput): ScheduleResult {
  const step = input.stepMinutes ?? 30;
  const limit = input.maxCandidates ?? 3;
  if (!input.teamId || input.timezone !== 'Asia/Seoul') throw new Error('팀 ID와 Asia/Seoul 시간대가 필요합니다.');
  for (const [name, value] of Object.entries({ durationMinutes: input.durationMinutes, stepMinutes: step, maxCandidates: limit })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name}은 양의 정수여야 합니다.`);
  }
  if (!input.members.length) throw new Error('참여자가 한 명 이상 필요합니다.');
  const ids = input.members.map(m => m.memberId);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error('참여자 ID는 비어 있거나 중복될 수 없습니다.');
  if (new Set(input.requiredMemberIds).size !== input.requiredMemberIds.length || input.requiredMemberIds.some(id => !ids.includes(id))) {
    throw new Error('필수 참석자 ID는 참여자 목록에 중복 없이 포함되어야 합니다.');
  }
  const [windowStart, windowEnd] = range(input.searchWindow);
  if ((windowEnd - windowStart) / (step * MINUTE) > 20_000) throw new Error('검색 범위를 줄이거나 후보 간격을 늘려 주세요.');
  const members = input.members.map(m => {
    if (!['provided', 'missing', 'needs_confirmation'].includes(m.responseStatus)) throw new Error('응답 상태가 올바르지 않습니다.');
    return { ...m, available: merge(m.availableSlots.map(range)), unavailable: m.unavailableSlots.map(range) };
  });
  const candidates: TimeCandidate[] = [];
  // 검색 시작 시각을 기준으로 stepMinutes마다 검사한다.
  for (let start = windowStart; start + input.durationMinutes * MINUTE <= windowEnd; start += step * MINUTE) {
    const end = start + input.durationMinutes * MINUTE;
    const availableMemberIds: string[] = [], unavailableMemberIds: string[] = [], unknownMemberIds: string[] = [];
    for (const m of members) {
      const blocked = m.unavailable.some(([s, e]) => s < end && start < e);
      const overlapsAvailable = m.available.some(([s, e]) => s < end && start < e);
      if (m.responseStatus !== 'provided' || (blocked && overlapsAvailable)) unknownMemberIds.push(m.memberId);
      else if (blocked) unavailableMemberIds.push(m.memberId);
      else if (m.available.some(([s, e]) => s <= start && e >= end)) availableMemberIds.push(m.memberId);
      else unknownMemberIds.push(m.memberId);
    }
    if (!availableMemberIds.length) continue;
    const startAt = koreanTime(start), endAt = koreanTime(end);
    candidates.push({
      id: `time:${startAt}/${endAt}`, startAt, endAt,
      availableMemberIds, unavailableMemberIds, unknownMemberIds,
      availableCount: availableMemberIds.length,
      requiredMembersSatisfied: input.requiredMemberIds.every(id => availableMemberIds.includes(id)),
      needsConfirmation: unknownMemberIds.length > 0,
    });
  }
  candidates.sort((a, b) => b.availableCount - a.availableCount || Number(b.requiredMembersSatisfied) - Number(a.requiredMembersSatisfied) || a.startAt.localeCompare(b.startAt));
  // 비슷한 겹침 후보가 결과를 독점하지 않도록 우선순위 순으로 겹치지 않는 구간 선택.
  const selected: TimeCandidate[] = [];
  for (const candidate of candidates) {
    if (selected.every(other => candidate.endAt <= other.startAt || candidate.startAt >= other.endAt)) selected.push(candidate);
    if (selected.length >= limit) break;
  }
  const missingMemberIds = members.filter(m => m.responseStatus === 'missing').map(m => m.memberId);
  const unresolved = members.some(m => m.responseStatus !== 'provided' || !m.available.length);
  return {
    teamId: input.teamId,
    status: selected.length ? 'candidates_found' : unresolved ? 'awaiting_responses' : 'no_candidates',
    candidates: selected,
    missingMemberIds,
    needsConfirmation: unresolved || selected.some(c => c.needsConfirmation),
  };
}
