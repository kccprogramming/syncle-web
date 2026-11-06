import type { ExtractionInput } from './b-c-contract';

/** 모델이 반복 요일을 실제 날짜로 옮길 때 사용할 서울 달력. 대화나 주소는 만들지 않는다. */
export function scheduleTimeRules(input: ExtractionInput): string {
  const start = Date.parse(input.searchWindow.startAt), end = Date.parse(input.searchWindow.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 31 * 86400000) {
    throw new Error('검색 기간은 31일 이내의 올바른 날짜 범위여야 합니다.');
  }
  const days: string[] = [];
  const local = new Date(start + 9 * 3600000);
  for (let day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 9 * 3600000;
    day < end; day += 86400000) {
    const date = new Date(day + 9 * 3600000);
    days.push(`${date.toISOString().slice(0, 10)}(${'일월화수목금토'[date.getUTCDay()]})`);
  }
  return `
[일정 해석 규칙 — 가능 시간 누락 및 하루 전체 오해 방지]
- 검색 기간의 서울 날짜와 요일: ${days.join(', ')}. 시작·끝 경계는 입력 searchWindow를 따른다.
- 각 메시지의 senderId로 발화자를 구분한다. 다른 사람의 시간 조건을 복사하지 않는다.
- 날짜가 없는 반복 요일(매주, 월·수, 월화수)은 검색 기간 안의 해당 요일마다 적용한다. 명시된 날짜·이번 주·다음 주는 해당 범위만 적용한다.
- '월·수 18시부터 22시까지 알바'는 해당 월요일·수요일 각각 18:00~22:00 불가다. 하루 전체 불가로 확대하지 않는다.
- '목요일 공강이라 하루 종일 가능'은 해당 목요일 각각 00:00부터 다음 날 00:00까지 availableSlots다. unavailableSlots에 넣거나 누락하지 않는다. 실제 추천 시간 제한은 C가 적용한다.
- '월·화·수는 어렵고 나머지는 전부 가능'은 월·화·수 각각 하루 전체 불가, 검색 기간의 다른 요일 각각 하루 전체 가능이다. '나머지 가능'이라는 명시적 진술이 있으므로 availableSlots를 비우지 않는다.
- 반대로 '월·화·수는 어렵다'처럼 불가만 말한 경우 다른 날을 가능으로 추정하지 않는다.
- 같은 사람이 여러 메시지로 나눠 말한 조건은 합쳐 반영하고, 정정·철회된 부분만 최신 진술로 바꾼다. 후속 불가 메시지 때문에 앞서 명확히 말한 가능 시간 전체를 지우지 않는다.
- '2시에 끝나요', '5시에 끝나요'는 오전·오후 및 이후 회의 참석 가능 여부가 불명확하면 추측하지 않는다. 확실히 말한 다른 시간은 유지하고 불명확한 구간은 가능·불가 어느 쪽에도 확정해 넣지 않는다.
- '오전에 끝나요', '저녁은 어려워요'처럼 경계가 모호하면 임의로 00:00 경계를 만들어 하루 전체 불가로 바꾸지 않는다.
- 출력 전 발화자별 모든 명확한 가능/불가 진술이 반영됐는지 다시 확인한다. 시간은 초 00과 +09:00을 포함하고, 검색 기간 밖 구간은 제외한다.
`;
}
