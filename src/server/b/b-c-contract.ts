/** B(성하) → C(지우) 공유 규격 */

export type AiRequestKind = 'schedule' | 'summary' | 'tasks' | 'files' | 'minutes';

export type AiSettings = {
  isEnabled: boolean;
  readScope: 'ALL' | 'MENTION_ONLY';
};

export type AiCardItem = {
  text: string;
  sub?: string;
  tag?: string;
  assigneeId?: string | null; // 할 일 담당자 ID 추가
  due?: string | null;        // 할 일 마감일 기한 추가
};

export type AiStandardCardResponse = {
  kind: 'schedule' | 'summary' | 'tasks' | 'files';
  title: string;
  basis: string[];
  items: AiCardItem[];
};

export type AiMinutesTask = {
  taskName: string;
  assignee?: string | null; 
  dueDate?: string | null;  
  basis: string;     
};

export type AiMinutesDecided = {
  text: string;
  settled: boolean; 
};

export type AiMinutesCardResponse = {
  kind: 'minutes';
  title: string;
  basis: string[];
  summary: string[];
  decided: AiMinutesDecided[];
  tasks: AiMinutesTask[];
};

export type AiCardResponse = AiStandardCardResponse | AiMinutesCardResponse;

export type Slot = {
  startAt: string;
  endAt: string;
};

export type MemberAvailability = {
  memberId: string;
  responseStatus: 'provided' | 'missing' | 'needs_confirmation';
  availableSlots: Slot[];
  unavailableSlots: Slot[];
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
  placeType: string | null;
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
    visible_to?: string[] | null;
  }[];
};

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
  placeType: '회의 장소',
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

export type MeetingCandidate = Slot & {
  candidateId: string;
};

export type CandidateProposal = {
  proposalId: string;
  teamId: string;
  candidates: MeetingCandidate[];
};

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
