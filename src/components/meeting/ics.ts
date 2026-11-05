/**
 * 캘린더 파일(.ics)을 브라우저에서 바로 만들어 내려받게 해요. 서버가 필요 없어요.
 * 휴대폰·구글·애플 캘린더 모두 .ics 파일을 열면 일정으로 추가할 수 있어요.
 */

/** 회의 시간 (한국 시간). 예: "20261111T190000" */
export interface IcsEvent {
  uid: string;
  title: string;
  location: string;
  start: string;
  end: string;
  description?: string;
}

// 글자 안의 , ; \ 줄바꿈은 .ics 규칙대로 바꿔 줘야 해요
function esc(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(ev: IcsEvent) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Syncle//KO",
    "CALSCALE:GREGORIAN",
    // 서울 시간대 정보 (서머타임 없음)
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Seoul",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:KST",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${ev.uid}@syncle`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Asia/Seoul:${ev.start}`,
    `DTEND;TZID=Asia/Seoul:${ev.end}`,
    `SUMMARY:${esc(ev.title)}`,
    `LOCATION:${esc(ev.location)}`,
    ...(ev.description ? [`DESCRIPTION:${esc(ev.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/** .ics 파일을 만들어 내려받기 */
export function downloadIcs(ev: IcsEvent, fileName: string) {
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
