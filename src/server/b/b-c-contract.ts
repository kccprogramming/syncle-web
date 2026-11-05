/** B(성하) → C(지우) 공유 규격 */

/** AI 요청 처리 가능 종류 */
export type AiRequestKind = 'schedule' | 'summary' | 'tasks' | 'files' | 'minutes';

/** AI 팀 설정 정보 */
export type AiSettings = {
  isEnabled: boolean;
  readScope: 'ALL' | 'MENTION_ONLY';
};

/** 일반 앱 카드 아이템 규격 */
export type AiCardItem = {
  text: string;
  sub?: string; // 담당자, 마감일, 자료 설명 등
  tag?: string; // 장소 종류(합주실, 회식 장소 등), 확정/미정 상태 등
};

/** 일반 응답 앱 카드 규격 (schedule, summary, tasks, files) */
export type AiStandardCardResponse = {
  kind: 'schedule' | 'summary' | 'tasks' | 'files';
  title: string;
  basis: string[]; // 근거 메시지 ID 목록
  items: AiCardItem[];
};

/** 회의록 전용 할 일 아이템 */
export type AiMinutesTask = {
  taskName: string;
  assignee?: string; // 팀원 ID (모르면 비움)
  dueDate?: string;  // 마감 날짜 (모르면 비움)
  basis: string;     // 근거 메시지 ID
};

/** 회의록 전용 결정 사항 아이템 */
export type AiMinutesDecided = {
  text: string;
  settled: boolean; // true: 확정, false: 미정
};

/** 회의록 전용 응답 앱 카드 규격 (minutes) */
export type AiMinutesCardResponse = {
  kind: 'minutes';
  title: string;
  basis: string[]; // 근거 메시지 ID 목록
  summary: string[];
  decided: AiMinutesDecided[];
  tasks: AiMinutesTask[];
};

/** 통합 AI 앱 카드 응답 타입 */
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
  /** AI가 문맥에서 추출한 장소 종류(합주실, 회식 장소, 회의 장소 등). 미정 또는 온라인이면 null. */
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
    visible_to?: string[] | null; // 비공개 메시지 여부 확인용
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
