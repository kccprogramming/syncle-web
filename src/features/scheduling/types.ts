import type { Slot } from '../../server/b/b-c-contract';
export type { Slot, MemberAvailability, ScheduleInput } from '../../server/b/b-c-contract';
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
