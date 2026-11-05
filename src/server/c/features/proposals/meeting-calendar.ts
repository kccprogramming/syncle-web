import type { Meeting } from './proposal-flow.ts';

function utcStamp(value: string): string {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('시간대가 있는 시각이 필요합니다.');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error('올바른 시각이 필요합니다.');
  // 잘못된 날짜를 Date가 다음 달로 자동 보정하는 경우도 거부한다.
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value);
  if (!match) throw new Error('ISO 날짜 형식이 필요합니다.');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) throw new Error('존재하는 날짜를 입력해 주세요.');
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
/** RFC 5545의 75바이트 줄 접기. 한글 UTF-8 문자를 중간에서 자르지 않는다. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = '', bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { lines.push(current); current = ' '; bytes = 1; }
    current += char; bytes += size;
  }
  lines.push(current);
  return lines.join('\r\n');
}

/** 캘린더에 가져올 파일 내용만 생성한다. 계정 연동·알림·장소 예약은 하지 않는다. */
export function meetingToIcs(meeting: Meeting): string {
  if (!meeting.meetingId?.trim() || !meeting.teamId?.trim()) throw new Error('회의 ID와 팀 ID가 필요합니다.');
  const start = utcStamp(meeting.startAt), end = utcStamp(meeting.endAt);
  if (end <= start) throw new Error('회의 종료 시각은 시작 시각 뒤여야 합니다.');
  const description = [
    ...(meeting.dataMode === 'example' ? ['[예시 데이터] 실제 일정이 아닙니다.'] : []),
    ...meeting.agenda.map((item, index) => `${index + 1}. ${item}`),
    ...(meeting.meetingMode === 'offline' && meeting.place?.url ? [`장소 사이트: ${meeting.place.url}`] : []),
  ].join('\n');
  const location = meeting.meetingMode === 'online' ? '온라인 회의' : [meeting.place?.name, meeting.place?.address].filter(Boolean).join(' · ');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KCC//Meeting Coordinator//KO', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${encodeURIComponent(meeting.teamId)}.${encodeURIComponent(meeting.meetingId)}@kcc-meeting.invalid`,
    `DTSTAMP:${utcStamp(meeting.confirmedAt)}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${escapeText((meeting.dataMode === 'example' ? '[예시] ' : '') + meeting.purpose)}`,
    `LOCATION:${escapeText(location)}`, `DESCRIPTION:${escapeText(description)}`,
    'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
