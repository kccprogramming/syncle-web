import type { Slot, ScheduleInput as BScheduleInput } from '../../server/b/b-c-contract';
export type { Slot, MemberAvailability } from '../../server/b/b-c-contract';
/**
 * B의 ScheduleInput + C의 선택 입력 meetingHours (지우님 9834b43).
 * 지우님 묶음은 공유 계약(b-c-contract)에 넣었지만, 우리 통합본은 B 계약을 성하님 원본 그대로 두고 여기서만 더해요.
 */
export type ScheduleInput = BScheduleInput & {
  /** 매일 후보로 허용할 한국 시간. 없으면 09:00~22:00. */
  meetingHours?: { start: string; end: string };
};
export type TimeCandidate = Slot & {
  id: string;
  availableMemberIds: string[];
  unavailableMemberIds: string[];
  unknownMemberIds: string[];
  availableCount: number;
  requiredMembersSatisfied: boolean;
  needsConfirmation: boolean;
};
export type ScheduleResult = {
  teamId: string;
  status: 'candidates_found' | 'awaiting_responses' | 'no_candidates';
  candidates: TimeCandidate[];
  missingMemberIds: string[];
  needsConfirmation: boolean;
};
