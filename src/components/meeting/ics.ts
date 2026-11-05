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

/**
 * Google 캘린더 '일정 추가' 화면 주소 — 새 탭으로 열면 브라우저에 로그인된 Google 계정 캘린더에
 * 제목 · 시간 · 장소가 채워진 채로 열리고, 사용자가 '저장'만 누르면 돼요.
 * (앱이 캘린더에 직접 쓰려면 Google 캘린더 권한과 Google 앱 심사가 필요해서 이 방법을 써요)
 */
export function googleCalendarUrl(ev: IcsEvent) {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${ev.start}/${ev.end}`,
    ctz: "Asia/Seoul",
    location: ev.location,
    details: ev.description ?? "",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
