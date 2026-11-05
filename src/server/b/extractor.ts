import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ExtractionInput,
  Conditions,
  EXAMPLE_B_INPUT,
  EXAMPLE_B_OUTPUT,
  AiSettings,
  AiCardResponse,
} from './b-c-contract';
import { isDeepStrictEqual } from 'node:util';

type Obj = Record<string, unknown>;

function fail(path: string): never {
  throw new Error(`Invalid extraction: ${path}`);
}

function obj(x: unknown, path: string): Obj {
  if (!x || typeof x !== 'object' || Array.isArray(x)) fail(path);
  return x as Obj;
}

function str(x: unknown, path: string): asserts x is string {
  if (typeof x !== 'string' || !x.trim()) fail(path);
}

function list(x: unknown, path: string): unknown[] {
  if (!Array.isArray(x)) fail(path);
  return x;
}

function strings(x: unknown, path: string): string[] {
  const a = list(x, path);
  a.forEach(v => str(v, path));
  if (new Set(a).size !== a.length) fail(`${path}: duplicate`);
  return a as string[];
}

function positive(x: unknown, path: string): void {
  if (!Number.isSafeInteger(x) || (x as number) <= 0) fail(path);
}

export function filterMessagesForAi<
  T extends { text: string; visible_to?: string[] | null }
>(
  messages: T[],
  settings: AiSettings = { isEnabled: true, readScope: 'ALL' },
): T[] {
  if (!settings.isEnabled) return [];
  return messages.filter(msg => {
    if (msg.visible_to && msg.visible_to.length > 0) return false;
    if (settings.readScope === 'MENTION_ONLY') return msg.text.includes('@AI');
    return true;
  });
}

function timestamp(x: unknown, path: string): number {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/.test(x)) {
    fail(path);
  }
  const n = Date.parse(x);
  if (!Number.isFinite(n) || new Date(n + 9 * 3600000).toISOString().slice(0, 19) !== x.slice(0, 19)) {
    fail(path);
  }
  return n;
}

export function validateMessageTimestamp(value: unknown): number {
  if (typeof value !== 'string') fail('message.sentAt');
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) fail('message.sentAt');
  const [, base, , zone] = match;
  const wall = Date.parse(base + 'Z');
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 19) !== base) {
    fail('message.sentAt calendar');
  }
  if (zone !== 'Z') {
    const hours = Number(zone.slice(1, 3));
    const minutes = Number(zone.slice(4, 6));
    if (hours > 23 || minutes > 59 || zone === '-00:00') fail('message.sentAt offset');
  }
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) fail('message.sentAt');
  return instant;
}

/** 
 * 시간 초를 00으로 맞추거나 23:59:59를 보정하며, 기간 밖을 잘라냅니다. 
 * Mutates v.startAt and v.endAt to valid strings.
 */
function slot(
  x: unknown,
  path: string,
  window?: [number, number],
): [number, number] | null {
  const v = obj(x, path);

  const fix = (s: unknown) => {
    if (typeof s !== 'string') return s;
    if (s.endsWith(':59:59+09:00')) {
      const t = Date.parse(s);
      if (!Number.isNaN(t)) {
        return new Date(t + 1000 + 9 * 3600000).toISOString().slice(0, 19) + '+09:00';
      }
    }
    return s.replace(/:\d{2}(\.\d+)?\+09:00$/, ':00+09:00');
  };

  if ('startAt' in v) v.startAt = fix(v.startAt);
  if ('endAt' in v) v.endAt = fix(v.endAt);

  let a = timestamp(v.startAt, path + '.startAt');
  let b = timestamp(v.endAt, path + '.endAt');

  if (a >= b) return null; // 시작시간이 끝나는 시간보다 늦거나 같으면 무시

  if (window) {
    const clampedA = Math.max(a, window[0]);
    const clampedB = Math.min(b, window[1]);
    if (clampedA >= clampedB) return null; // 기간 완전 이탈시 무시
    
    v.startAt = new Date(clampedA + 9 * 3600000).toISOString().slice(0, 19) + '+09:00';
    v.endAt = new Date(clampedB + 9 * 3600000).toISOString().slice(0, 19) + '+09:00';
    return [clampedA, clampedB];
  }

  return [a, b];
}

export function validateMeetingSlot(
  value: unknown,
  window?: { startAt: string; endAt: string; },
): [number, number] {
  const winNum = window ? slot(window, 'searchWindow') : undefined;
  const res = slot(value, 'slot', winNum === null ? undefined : winNum);
  if (!res) fail('slot is out of bounds or invalid');
  return res;
}

export function validateInput(input: ExtractionInput): void {
  const i = obj(input, 'input');
  str(i.teamId, 'teamId');
  if (i.timezone !== 'Asia/Seoul') fail('timezone');
  if (typeof i.referenceDate !== 'string') fail('referenceDate');
  timestamp(i.referenceDate + 'T00:00:00+09:00', 'referenceDate');
  slot(i.searchWindow, 'searchWindow');

  const ids = list(i.members, 'members').map(m => {
    const v = obj(m, 'member');
    str(v.memberId, 'memberId');
    str(v.name, 'name');
    if (v.station !== null) str(v.station, 'station');
    return v.memberId;
  });

  if (!ids.length || new Set(ids).size !== ids.length) fail('members');

  const required = strings(i.requiredMemberIds, 'requiredMemberIds');
  if (!required.length || required.some(id => !ids.includes(id))) fail('requiredMemberIds');

  const msgIds = list(i.messages, 'messages').map(m => {
    const v = obj(m, 'message');
    str(v.id, 'message.id');
    str(v.text, 'message.text');
    if (!ids.includes(v.senderId as string)) fail('message.senderId');
    validateMessageTimestamp(v.sentAt);
    return v.id;
  });

  if (new Set(msgIds).size !== msgIds.length) fail('message IDs');
}

export type ConfirmationQuestion = {
  field: string;
  memberId?: string;
  question: string;
};

export class ConfirmationRequiredError extends Error {
  constructor(public readonly questions: ConfirmationQuestion[]) {
    super('회의 조건 확인이 필요합니다.');
    this.name = 'ConfirmationRequiredError';
  }
}

export function validateConditions(data: unknown, input: ExtractionInput): Conditions {
  validateInput(input);
  const d = obj(data, 'result');
  const s = obj(d.schedule, 'schedule');

  for (const key of ['teamId', 'timezone', 'searchWindow', 'requiredMemberIds'] as const) {
    if (!isDeepStrictEqual(s[key], input[key])) fail('schedule.' + key);
  }

  const window = slot(s.searchWindow, 'searchWindow');
  if (!window) fail('searchWindow invalid');

  const questions: ConfirmationQuestion[] = [];
  if (d.purpose === null) {
    questions.push({ field: 'purpose', question: '회의 목적은 무엇인가요?' });
  } else {
    str(d.purpose, 'purpose');
  }

  if (d.meetingMode === null) {
    questions.push({ field: 'meetingMode', question: '대면 회의인가요, 온라인 회의인가요?' });
  } else if (d.meetingMode !== 'offline' && d.meetingMode !== 'online') {
    fail('meetingMode');
  }

  if (s.durationMinutes === null) {
    questions.push({ field: 'durationMinutes', question: '회의는 몇 분 진행하나요?' });
  } else {
    positive(s.durationMinutes, 'durationMinutes');
  }

  for (const key of ['stepMinutes', 'maxCandidates']) {
    if (s[key] !== undefined) positive(s[key], key);
  }

  strings(d.agenda, 'agenda');
  strings(d.placeRequirements, 'placeRequirements');
  if (d.placeType !== null) str(d.placeType, 'placeType');

  if (d.meetingMode === 'online' && d.placeType !== null) {
    fail('placeType must be null for online meetings');
  }

  const sources = strings(d.sourceMessageIds, 'sourceMessageIds');
  if (!sources.length || sources.some(id => !input.messages.some(m => m.id === id))) {
    fail('sourceMessageIds');
  }

  const ids = input.members.map(m => m.memberId);
  const members = list(s.members, 'schedule.members');
  const seen = new Set<string>();

  for (const raw of members) {
    const m = obj(raw, 'member');
    str(m.memberId, 'memberId');

    if (!ids.includes(m.memberId) || seen.has(m.memberId)) fail('memberId');
    seen.add(m.memberId);

    if (!['provided', 'missing', 'needs_confirmation'].includes(m.responseStatus as string)) {
      fail('responseStatus');
    }

    const filterAndFixSlots = (rawSlots: any[], path: string) => {
      const result: any[] = [];
      const numResult: [number, number][] = [];
      for (const st of rawSlots) {
        const num = slot(st, path, window);
        if (num !== null) {
          result.push(st);
          numResult.push(num);
        }
      }
      return { result, numResult };
    };

    const availData = filterAndFixSlots(list(m.availableSlots, 'availableSlots'), 'availableSlots');
    let available = availData.numResult;

    if (m.preferredSlots !== undefined) {
      const prefData = filterAndFixSlots(list(m.preferredSlots, 'preferredSlots'), 'preferredSlots');
      m.preferredSlots = prefData.result;
    }

    const unavailData = filterAndFixSlots(list(m.unavailableSlots, 'unavailableSlots'), 'unavailableSlots');
    m.unavailableSlots = unavailData.result;
    const unavailable = unavailData.numResult;

    // 겹치는 부분 '안 되는 시간'으로 다듬기 (subtract unavailable from available)
    let finalAvailable: [number, number][] = [];
    for (const [aStart, aEnd] of available) {
      let currentParts: [number, number][] = [[aStart, aEnd]];
      for (const [uStart, uEnd] of unavailable) {
        let nextParts: [number, number][] = [];
        for (const [cStart, cEnd] of currentParts) {
          if (cStart >= uEnd || cEnd <= uStart) {
            nextParts.push([cStart, cEnd]);
          } else {
            if (cStart < uStart) nextParts.push([cStart, uStart]);
            if (cEnd > uEnd) nextParts.push([uEnd, cEnd]);
          }
        }
        currentParts = nextParts;
      }
      finalAvailable.push(...currentParts);
    }

    m.availableSlots = finalAvailable.map(([s, e]) => ({
      startAt: new Date(s + 9 * 3600000).toISOString().slice(0, 19) + '+09:00',
      endAt: new Date(e + 9 * 3600000).toISOString().slice(0, 19) + '+09:00'
    }));
    available = finalAvailable;

    if (m.responseStatus !== 'provided' && available.length) fail('unconfirmed availability');
    if (m.responseStatus === 'missing' && unavailable.length) fail('missing with slots');
    if (m.responseStatus === 'provided' && !available.length && !unavailable.length) fail('provided without slots');
  }

  if (seen.size !== ids.length) fail('members missing');

  const origins = list(d.origins, 'origins');
  const originIds = new Set<string>();

  for (const raw of origins) {
    const o = obj(raw, 'origin');
    str(o.memberId, 'origin.memberId');
    if (!ids.includes(o.memberId) || originIds.has(o.memberId)) fail('origin.memberId');
    originIds.add(o.memberId);
    if (o.station !== null) str(o.station, 'origin.station');
  }

  if (originIds.size !== ids.length) fail('origins missing');
  if (questions.length) throw new ConfirmationRequiredError(questions);

  return structuredClone(d) as Conditions;
}

export async function analyzeMessagesMock(input: ExtractionInput): Promise<Conditions> {
  if (!isDeepStrictEqual(input, EXAMPLE_B_INPUT)) {
    throw new Error('Mock supports EXAMPLE_B_INPUT only; inject a fixture for other inputs.');
  }
  return validateConditions(EXAMPLE_B_OUTPUT, input);
}

export type ExtractionResult =
  | { status: 'ready'; conditions: Conditions; }
  | { status: 'needs_confirmation'; questions: ConfirmationQuestion[]; draft?: Conditions; };

export function validateExtraction(data: unknown, input: ExtractionInput): ExtractionResult {
  try {
    const conditions = validateConditions(data, input);
    const questions = conditions.schedule.members
      .filter(m => m.responseStatus !== 'provided' || m.availableSlots.length === 0)
      .map(m => ({
        field: 'availability',
        memberId: m.memberId,
        question: '확실히 참석 가능한 날짜와 시간을 알려주세요.',
      }));

    return questions.length
      ? { status: 'needs_confirmation', questions, draft: conditions }
      : { status: 'ready', conditions };
  } catch (e) {
    if (e instanceof ConfirmationRequiredError) {
      return { status: 'needs_confirmation', questions: e.questions };
    }
    throw e;
  }
}

export function parseConditions(text: string, input: ExtractionInput): Conditions {
  return validateConditions(JSON.parse(text), input);
}

export type GenerateText = (prompt: string) => Promise<string>;

export async function analyzeMessages(
  input: ExtractionInput,
  generateText?: GenerateText,
): Promise<Conditions> {
  validateInput(input);

  const prompt = `
너는 한국어 대화에서 회의 조건을 추출하는 도우미다.
입력 대화를 분석해서 아래 예시와 같은 구조의 JSON 객체만 반환한다. 마크다운이나 설명은 붙이지 않는다.

[출력 구조 예시]
${JSON.stringify(EXAMPLE_B_OUTPUT, null, 2)}

[중요]
- '회의', '미팅'뿐만 아니라 '합주 잡아줘', '회식 잡아줘', '모임 잡아줘'도 일정/회의 잡기로 판단한다.
- 목적은 최상위 purpose에 문자열로 넣는다.
- 대면/온라인은 최상위 meetingMode에 offline 또는 online으로 넣는다.
- 장소 종류는 최상위 placeType에 짧은 문자열로 넣는다. 예: 합주실, 음식점, 카페, 스터디룸. 구체적 상호는 넣지 않는다. 모르면 null.
- 회의 길이는 schedule.durationMinutes에 분 단위 정수로 넣는다.
- schedule.members에는 입력의 모든 참여자를 포함한다.
- 명확한 시간 조건은 provided, 일정 미응답은 missing, 모호/충돌은 needs_confirmation.
- 불가 시간만 말했다고 나머지 시간을 가능으로 채우지 않는다.
- 시간은 "23:59:59"와 같은 형식이 되지 않게, 필요한 경우 정각 시간 단위로 작성하라.
- 상대 날짜는 해당 메시지의 sentAt을 기준으로 해석한다.
- 정정·철회는 최신 문맥에 반영한다. 근거 메시지 ID는 실제 있는 것만 쓴다.

[실제 입력]
${JSON.stringify(input, null, 2)}
`;

  let text: string;
  if (generateText) {
    text = await generateText(prompt);
  } else {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY is required for live calls.');
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
      generationConfig: { responseMimeType: 'application/json' },
    });
    text = (await model.generateContent(prompt)).response.text();
  }

  return parseConditions(text, input);
}

export async function analyzeAiCard(
  input: ExtractionInput,
  requestKind: 'summary' | 'tasks' | 'files' | 'minutes',
  aiSettings: AiSettings = { isEnabled: true, readScope: 'ALL' },
  existingTasks: string[] = [],
  generateText?: GenerateText,
): Promise<AiCardResponse> {
  validateInput(input);
  const validMessages = filterMessagesForAi(input.messages, aiSettings);

  const prompt = `
너는 팀 커뮤니케이션을 돕는 AI 어시스턴트다.
대화 내용을 분석하여 사용자가 이번에 요청한 [${requestKind}]에 맞는 단 1개의 JSON 객체만 생성하라 (절대 배열 형태로 여러 개를 반환하지 마라).

[컨텍스트 정보]
- 오늘 날짜(기준일): ${input.referenceDate}
- 팀원 목록: ${JSON.stringify(input.members.map(m => ({ id: m.memberId, name: m.name })))}
- 기존 등록된 할 일(제외 대상): ${JSON.stringify(existingTasks)}

[JSON 출력 규격]
반드시 아래의 요청 종류(${requestKind})에 맞는 1개의 객체 형식만 출력한다.
- basis 필드에는 설명 글을 쓰지 말고, 반드시 입력 메시지의 실제 id 배열(예: ["m1", "m2"])만 포함한다.
- 담당자(assignee/assigneeId)는 이름이 아닌 위 팀원 목록의 id(예: "u1")를 사용한다. 모르면 null로 한다.
- 날짜(due/dueDate)는 오늘 날짜(${input.referenceDate})를 기준으로 계산하여 "YYYY-MM-DD"로 적고 모르면 null로 한다.

1. tasks (할 일 정리) 카드 형식:
{
  "kind": "tasks",
  "title": "할 일 정리",
  "basis": ["msg_id"],
  "items": [ { "text": "할일 내용", "assigneeId": "팀원id 또는 null", "due": "YYYY-MM-DD 또는 null" } ]
}
2. summary, files 카드 형식:
{
  "kind": "${requestKind}",
  "title": "제목",
  "basis": ["msg_id"],
  "items": [ { "text": "내용", "sub": "설명", "tag": "태그" } ]
}
3. minutes (회의록 정리) 카드 형식:
{
  "kind": "minutes",
  "title": "회의록 정리",
  "basis": ["msg_id"],
  "summary": ["요약1", "요약2"],
  "decided": [ { "text": "결정내용", "settled": true } ],
  "tasks": [ { "taskName": "할일", "assignee": "팀원id 또는 null", "dueDate": "YYYY-MM-DD 또는 null", "basis": "msg_id" } ]
}

[입력 메시지 목록]
${JSON.stringify(validMessages, null, 2)}
`;

  let text: string;
  if (generateText) {
    text = await generateText(prompt);
  } else {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY is required.');
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
      generationConfig: { responseMimeType: 'application/json' },
    });
    text = (await model.generateContent(prompt)).response.text();
  }

  return JSON.parse(text) as AiCardResponse;
}
