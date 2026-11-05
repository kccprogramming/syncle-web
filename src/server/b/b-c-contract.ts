/** B(성하) → C(지우) 공유 규격 */

export type Slot = {
  startAt: string;
  endAt: string;
};

export type MemberAvailability = {
  memberId: string;
  responseStatus: 'provided' | 'missing' | 'needs_confirmation';
  availableSlots: Slot[];
  unavailableSlots: Slot[];
  /** 선호 시간은 확정 가능 시간으로 취급하지 않는다. */
  preferredSlots?: Slot[];
};

export type ScheduleInput = {
  teamId: string;
  timezone: 'Asia/Seoul';
  searchWindow: Slot;
  durationMinutes: number;
  requiredMemberIds: string[];
  members: MemberAvailability[];
  stepMinutes?: number;
  maxCandidates?: number;
};

export type Conditions = {
  schedule: ScheduleInput;
  purpose: string;
  meetingMode: 'offline' | 'online';
  agenda: string[];
  sourceMessageIds: string[];
  origins: {
    memberId: string;
    station: string | null;
  }[];
  placeRequirements: string[];
};

export type ExtractionInput = {
  teamId: string;
  timezone: 'Asia/Seoul';
  referenceDate: string;
  searchWindow: Slot;
  requiredMemberIds: string[];
  members: {
    memberId: string;
    name: string;
    station: string | null;
  }[];
  messages: {
    id: string;
    senderId: string;
    text: string;
    sentAt: string;
  }[];
};

/** AI 추출 및 Mock 테스트용 입력 */
export const EXAMPLE_B_INPUT: ExtractionInput = {
  teamId: 'team-example',
  timezone: 'Asia/Seoul',
  referenceDate: '2026-11-04',
  searchWindow: {
    startAt: '2026-11-09T00:00:00+09:00',
    endAt: '2026-11-16T00:00:00+09:00',
  },
  requiredMemberIds: ['u1', 'u2'],
  members: [
    {
      memberId: 'u1',
      name: '예시 팀원 1',
      station: '수원역',
    },
    {
      memberId: 'u2',
      name: '예시 팀원 2',
      station: null,
    },
  ],
  messages: [
    {
      id: 'm1',
      senderId: 'u1',
      sentAt: '2026-11-04T18:00:00+09:00',
      text: '11월 10일 만나서 발표 자료 역할 분담하자. 발표 파트별 담당을 정하면 돼. 회의는 1시간으로 하고 노트북 작업 가능한 곳이 필요해. 나는 그날 오후 7시부터 9시까지 가능해.',
    },
    {
      id: 'm2',
      senderId: 'u2',
      sentAt: '2026-11-04T18:01:00+09:00',
      text: '좋아. 나도 11월 10일 오후 7시부터 9시까지 가능해.',
    },
  ],
};

/**
 * Mock 연결 확인용 예시 출력.
 * 실제 AI가 생성한 결과는 아니다.
 */
export const EXAMPLE_B_OUTPUT: Conditions = {
  schedule: {
    teamId: 'team-example',
    timezone: 'Asia/Seoul',
    searchWindow: {
      startAt: '2026-11-09T00:00:00+09:00',
      endAt: '2026-11-16T00:00:00+09:00',
    },
    durationMinutes: 60,
    requiredMemberIds: ['u1', 'u2'],
    members: [
      {
        memberId: 'u1',
        responseStatus: 'provided',
        availableSlots: [
          {
            startAt: '2026-11-10T19:00:00+09:00',
            endAt: '2026-11-10T21:00:00+09:00',
          },
        ],
        unavailableSlots: [],
      },
      {
        memberId: 'u2',
        responseStatus: 'provided',
        availableSlots: [
          {
            startAt: '2026-11-10T19:00:00+09:00',
            endAt: '2026-11-10T21:00:00+09:00',
          },
        ],
        unavailableSlots: [],
      },
    ],
  },
  purpose: '발표 자료 역할 분담',
  meetingMode: 'offline',
  agenda: ['발표 파트별 담당 정하기'],
  sourceMessageIds: ['m1', 'm2'],
  origins: [
    {
      memberId: 'u1',
      station: '수원역',
    },
    {
      memberId: 'u2',
      station: null,
    },
  ],
  placeRequirements: ['노트북 작업 가능한 공간'],
};

/**
 * B ↔ C ↔ A ↔ 프런트 연결을 위한 제안 규격.
 * 실제 서비스 어댑터와의 필드명 대조가 필요하다.
 */
export type MeetingCandidate = Slot & {
  candidateId: string;
};

export type CandidateProposal = {
  proposalId: string;
  teamId: string;
  candidates: MeetingCandidate[];
};

/** C가 제공하는 제안·참석자별 최신 저장 응답 */
export type CandidateResponse = {
  proposalId: string;
  memberId: string;
  responseStatus: 'pending' | 'selected' | 'declined_all';
  selectedCandidateIds: string[];
};

export type ConfirmationCard = {
  type: 'availability_confirmation';
  proposalId: string;
  teamId: string;
  targetMemberId: string;
  question: string;
  candidates: MeetingCandidate[];
  allowDeclineAll: true;
};