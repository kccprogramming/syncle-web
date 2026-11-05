/**
 * 싱클에서 쓰는 데이터 모양.
 * 백엔드 API가 돌려줄 JSON도 이 모양에 맞춰요 (기획서 '개발 역할 분담' 5장·9장).
 */

export type UserId = string;
export type TeamId = string;

/** 사람 (profiles) */
export interface Member {
  id: UserId;
  name: string;
  /** 아바타에 쓰는 한 글자 */
  initial: string;
  /** 아바타 배경색 / 글자색 */
  color: string;
  ink: string;
}

/** 매주 안 되는 시간 */
export interface WeeklyBlock {
  id: string;
  days: string[]; // ["월", "수"]
  allDay: boolean;
  start?: string; // "14:00"
  end?: string; // "18:00"
  memo?: string;
}

/** 로그인한 나 (GET /api/me) */
export interface Me extends Member {
  provider: "google";
  /** 정확한 출발지 (나만 봄) */
  origin: string;
  /** 다른 팀원에게 보이는 동네 */
  originArea: string;
  weeklyBlocks: WeeklyBlock[];
  notificationsOn: boolean;
}

/** 팀 (teams + team_members) */
export interface Team {
  id: TeamId;
  name: string;
  initial: string;
  color: string;
  ink: string;
  memberIds: UserId[];
  ownerId: UserId;
  aiEnabled: boolean;
  aiScope: "all" | "mention";
  inviteCode: string;
  createdAt: string; // "2026-10-21"
  createdLabel: string; // "10/21"
  lastMessage: string;
  unread: number;
  /** 홈 '내 팀' 목록에 보이는 부가 설명 (없으면 lastMessage) */
  homeNote?: string;
}

/** 대화 메시지 (messages). type에 따라 화면에 그리는 모양이 달라요. */
export type Message =
  | { id: string; type: "text"; senderId: UserId; text: string; at: string }
  | { id: string; type: "file"; senderId: UserId; fileName: string; size: string; at: string; /** 이 기기에서 올리는 중 (끝나면 진짜 메시지로 바뀌어요) */ uploading?: boolean }
  | { id: string; type: "mention-ai"; senderId: UserId; text: string; at: string }
  | { id: string; type: "system"; text: string; at: string }
  | { id: string; type: "ai-proposal"; proposalId: string; at: string }
  | { id: string; type: "ai-confirmed"; meetingId: string; at: string }
  | {
      id: string;
      type: "ai-question";
      proposalId: string;
      /** 이 메시지를 볼 수 있는 사람 (나머지에게는 안 보임) */
      visibleTo: UserId[];
      at: string;
    };

/** 시간 후보 (time_options) */
export interface TimeOption {
  /** 화면 안에서 쓰는 순서 이름 (t-1, t-2 …). 내 응답(myPicks)과 맞춰요 */
  id: string;
  /** C가 만든 진짜 시간 후보 ID ("time:시작/끝"). C 확정 API에는 이 값을 넘겨요. 가짜 데이터에는 없어요 */
  cTimeCandidateId?: string;
  label: string; // "11/11(수) 19:00–21:00"
  short: string; // "11/11(수) 19:00"
  /** 시작·끝 시각 (서울 시간, ISO 8601). D 장소 추천과 B 일정 계산에 써요 */
  startAt: string; // "2026-11-11T19:00:00+09:00"
  endAt: string;
  availableCount: number; // 응답한 사람 중 가능 인원
  respondedCount: number;
  recommended: boolean;
  /** 추천하지 않은 이유 (다른 후보일 때) */
  whyNot?: string;
  whyNotDetail?: string;
}

/** AI가 참고한 발언 */
export interface Source {
  who: string;
  quote: string;
  effect: string;
}

/**
 * 회의 확정 요청 — C 확정 API (confirmProposal)에 넘기는 값
 * 장소는 6 장소 후보에서 고른 것을 그대로 넘기고, C가 그 시간 기준으로 장소를 확인해요 (11/6 C와 합의).
 * 회의 ID · 확정 시각 · 확정한 사람(방장)은 서버가 정해요.
 */
export interface ConfirmRequest {
  proposalId: string;
  /** C의 시간 후보 ID (TimeOption.cTimeCandidateId). 가짜 데이터 제안이면 화면 ID(t-1 …) */
  timeCandidateId: string;
  /** 6에서 고른 장소 ID. 온라인 회의면 null */
  placeId: string | null;
  /** 응답 안 한 팀원이 있는데도 확정 ('그래도 확정할까요?'에서 확정을 누름) */
  acknowledgePartialAttendance: boolean;
}

/** 회의 제안 (proposals) — GET /api/proposals/:id */
export interface Proposal {
  id: string;
  teamId: TeamId;
  title: string;
  mode: "offline" | "online";
  durationLabel: string; // "약 2시간"
  placeNote: string; // "노트북 작업 가능한 곳"
  status: "collecting" | "confirmed" | "no-match";
  deadline: string; // "11/6(금) 21:00"
  deadlineDday: string; // "D-1"
  deadlineReason: string;
  respondedIds: UserId[];
  pendingIds: UserId[];
  times: TimeOption[];
  reasons: string[];
  /** 추천 시간 아래 한 줄 메모 */
  pendingNote: string;
  placeId: string;
  agenda: string[];
  sources: Source[];
  /** 대화방 카드에 보이는 요약 */
  cardSummary: { timeLabel: string; candidateCount: number; placeLabel: string; maxMinutes: number };
  /** 회의 잡기 진행 단계 (3-1-1) */
  progress: { step: "reading" | "times" | "places" | "done" | "partial-fail"; messageCount: number };
}

/** 장소 후보 (place_options) — GET /api/proposals/:id/places */
export interface PlaceOption {
  id: string;
  label: string; // "A"
  name: string; // "스터디룸 A · 6인실"
  short: string; // "스터디룸 A"
  walk: string; // "서울역 도보 4분"
  /** 장소 사이트 주소 (D의 detailUrl · 카카오맵 장소 페이지). 예약·요금·시설은 여기서 확인해요 */
  url: string;
  /** 가장 오래 걸리는 사람의 이동시간 (D의 maxTravelMinutes). 일부 이동시간을 모르면 null */
  maxMinutes: number | null;
  /** 사람 간 이동시간 차이 (D의 travelTimeDifference). 모르면 null */
  diffMinutes?: number | null;
  /** 공평성 순위 1부터 (D의 rank). 순위를 매길 수 없으면 null */
  rank?: number | null;
  /** 장소 주소 (D의 address) */
  address?: string;
  /** 사람별 이동시간. minutes가 null이면 출발지나 경로를 확인하지 못한 것(D의 unknown/error) */
  travel: { who: string; minutes: number | null }[];
  reason: string;
  /** 지도 위 표시 위치 (지도 영역 안의 %) */
  pin: { x: number; y: number };
}

/** AI가 이해한 조건 (conditions) */
export interface Condition {
  id: string;
  title: string;
  source: string;
  fromAi: boolean;
  kind: "no" | "prefer";
}

/** 확정된 회의 (meetings) */
export interface Meeting {
  id: string;
  teamId: TeamId;
  proposalId?: string;
  title: string;
  dateLabel: string; // "11월 11일 (수) 19:00–21:00"
  shortLabel: string; // "11/11(수) 19:00"
  month: string; // "11월"
  day: string; // "11"
  placeName: string;
  placeMeta: string;
  attendeeIds: UserId[];
  agenda: string[];
  myRoute?: { from: string; to: string; minutes: number; leaveAt: string };
  hasMinutes: boolean;
  status: "upcoming" | "past";
  /** 지난 회의 목록에 보이는 한 줄 */
  pastMeta?: string;
}

/** 할 일 (tasks) */
export interface Task {
  id: string;
  title: string;
  assigneeId: UserId;
  due: string; // "11/6(금)까지"
  done: boolean;
  source: "manual" | "ai" | "minutes";
}

/** 팀 자료 (files) */
export interface TeamFile {
  id: string;
  kind: "file" | "photo" | "link";
  ext: "PPT" | "PDF" | "AI" | "링크" | "사진" | "파일";
  name: string;
  meta: string;
  isNew?: boolean;
  /** 진짜 팀 자료(A)일 때: 사진 미리보기 주소 (1시간) */
  thumbUrl?: string;
  /** 진짜 팀 자료(A)일 때: 보관함 안 위치 (열 때 주소를 새로 받아요) */
  filePath?: string;
  /** 링크 자료일 때 주소 */
  url?: string;
}

/** 앱 안 알림 (notifications) */
export interface AppNotification {
  id: string;
  kind: "due" | "ai" | "file" | "task" | "done";
  teamName: string;
  time: string;
  text: string;
  href: string;
  unread: boolean;
  group: "today" | "before";
}

/** 회의록 (minutes) */
export interface Minutes {
  meetingId: string;
  title: string;
  meta: string;
  summary: string[];
  decided: { text: string; settled: boolean }[];
  tasks: { id: string; title: string; meta: string }[];
}

/** 공통 시간이 없을 때 대안 (5-3) */
export interface NoMatchOption {
  id: "most" | "online" | "extend";
  title: string;
  when: string;
  note: string;
  recommended: boolean;
  cta: string;
}

/**
 * 카카오 로컬 API '키워드로 장소 검색' 응답 (GET https://dapi.kakao.com/v2/local/search/keyword.json).
 * src/mocks/place-search.json도 이 모양 그대로예요. 쓰지 않는 필드(phone, place_url 등)도 응답에 맞춰 둬요.
 * 주의: 카카오는 x = 경도(lng), y = 위도(lat)를 '문자열'로 줘요.
 */
export interface KakaoPlaceDocument {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string; // 지번 주소
  road_address_name: string; // 도로명 주소
  x: string; // 경도 (lng)
  y: string; // 위도 (lat)
  place_url: string;
  distance: string;
}
export interface KakaoKeywordSearchResponse {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
    same_name: { region: string[]; keyword: string; selected_region: string } | null;
  };
  documents: KakaoPlaceDocument[];
}

/** 출발지 검색 결과 한 개 (화면에서 쓰는 모양, data.ts가 카카오 응답을 바꿔서 줘요) */
export interface PlaceSearchResult {
  id: string;
  /** 장소 이름 "대화역 3호선" */
  name: string;
  /** 도로명 주소 (없으면 지번 주소) */
  roadAddress: string;
  /** 지번 주소 */
  address: string;
  lat: number;
  lng: number;
  /** 팀원에게 보이는 동네 "대화동" */
  area: string;
}

/**
 * 카카오 로컬 API '주소 검색' 응답 (GET https://dapi.kakao.com/v2/local/search/address.json).
 * "정릉로 77"처럼 도로명·지번 주소를 넣었을 때 써요. 쓰는 필드만 적었어요.
 */
export interface KakaoAddressSearchResponse {
  meta: { total_count: number; pageable_count: number; is_end: boolean };
  documents: {
    address_name: string;
    address_type: "REGION" | "ROAD" | "REGION_ADDR" | "ROAD_ADDR";
    x: string; // 경도 (lng)
    y: string; // 위도 (lat)
    address: { address_name: string; region_3depth_name: string } | null;
    road_address: { address_name: string; building_name: string; region_3depth_name: string } | null;
  }[];
}

/**
 * '@AI 부탁'에 대한 AI 답 (회의 잡기 말고 나머지: 요약·할 일·자료·회의록·도움말).
 * 백엔드에서는 POST /api/teams/:id/ai 가 이 모양으로 돌려줘요.
 */
export interface AiReply {
  /** conditions·questions·notice는 B(회의 조건 추출)가 만든 답이에요 */
  kind: "summary" | "tasks" | "files" | "minutes" | "help" | "conditions" | "questions" | "notice";
  title: string;
  /** 무엇을 보고 답했는지 (디자인 원칙 5: AI는 근거를 같이 보여줘요) */
  basis: string;
  items: { text: string; sub?: string; tag?: string }[];
  /** 카드 아래 '자세히 보기' 링크 */
  link?: { label: string; href: string };
}
