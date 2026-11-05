"use client";

/**
 * 8 확정 회의 카드 (+ 8-2 참석 어려움 시트)
 * 예약은 앱에서 하지 않고, '장소 사이트에서 예약하기'로 장소 사이트(카카오맵 장소 페이지)를 새 탭으로 열어요.
 * /meetings/m-1               기본
 * /meetings/m-1?sheet=absent  참석 어려움 시트를 연 채로 시작
 */
import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { AvatarStack } from "@/components/Avatar";
import { useDemo } from "@/lib/demo-store";
import { getMe, getMeeting, getMember, getMembers, getPlaces, getTeam } from "@/lib/data";
import { StatusPill } from "@/components/meeting/StatusPill";
import { AbsentSheet } from "@/components/meeting/AbsentSheet";
import { downloadIcs } from "@/components/meeting/ics";

// 캘린더 파일에 넣을 정확한 시각 (한국 시간)
// TODO: API 연결 시 data.ts로 옮기기 (회의 데이터에 시작·끝 시각 넣기)
const MEETING_TIMES: Record<string, { start: string; end: string; startMin: number }> = {
  "m-1": { start: "20261111T190000", end: "20261111T210000", startMin: 19 * 60 },
};

/** 회의 시작 시각에서 이동 시간을 빼고 10분 단위로 내림 → "18:10" */
function leaveAt(startMin: number, travelMin: number) {
  const t = Math.floor((startMin - travelMin) / 10) * 10;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export default function MeetingPage() {
  return (
    <Suspense fallback={null}>
      <MeetingInner />
    </Suspense>
  );
}

function MeetingInner() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const sp = useSearchParams();
  const { state } = useDemo();
  const me = getMe();

  const meeting = getMeeting(meetingId);
  const team = getTeam(meeting.teamId);
  const owner = getMember(team.ownerId);
  const proposalId = meeting.proposalId ?? "p-1";
  const times = MEETING_TIMES[meeting.id] ?? MEETING_TIMES["m-1"];
  const chatHref = `/teams/${meeting.teamId}`;

  // 장소: 6에서 고른 장소 (온라인이면 장소 없음)
  const online = state.mode === "online";
  const place = getPlaces(proposalId).places.find((p) => p.id === state.placeId);
  const placeName = online ? "온라인 회의" : place?.name ?? meeting.placeName;
  const myTravel = place?.travel.find((t) => t.who === me.name)?.minutes ?? meeting.myRoute?.minutes ?? 0;

  const [sheet, setSheet] = useState<string | null>(sp.get("sheet"));

  function addToCalendar() {
    downloadIcs(
      {
        uid: `${meeting.id}-${state.placeId}`,
        title: meeting.title,
        location: placeName,
        start: times.start,
        end: times.end,
        description: `${team.name} · 안건: ${meeting.agenda.join(", ")}`,
      },
      `syncle-${meeting.id}.ics`,
    );
  }

  return (
    <main className="screen">
      <TopBar back={chatHref} backLabel="대화방으로" title="회의 카드" right={<StatusPill tone="ok">확정</StatusPill>} />

      <div className="screen__body">
        <section className="card card--flush" style={{ borderRadius: 16, overflow: "hidden" }}>
          <div className="stack gap-6" style={{ background: "var(--accent)", color: "#fff", padding: 20 }}>
            <span className="t-13" style={{ opacity: 0.9 }}>
              {team.name}
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>{meeting.title}</h1>
            <span className="t-15" style={{ fontWeight: 500 }}>
              {meeting.dateLabel}
            </span>
          </div>
          <div className="stack" style={{ padding: "16px 20px", gap: 14 }}>
            <div className="hstack gap-12" style={{ alignItems: "flex-start" }}>
              <span style={{ marginTop: 2 }}>
                <Icon name={online ? "video" : "pin"} strokeWidth={1.8} color="var(--muted)" />
              </span>
              <div className="stack gap-2">
                <span className="t-15 t-strong">{placeName}</span>
                {online ? (
                  <span className="t-12 t-muted">방장이 회의 링크를 대화방에 올려요</span>
                ) : (
                  <>
                    <span className="t-12 t-muted">{place?.walk ?? meeting.placeMeta}</span>
                    <span className="t-12 t-muted">시설·요금·예약은 장소 사이트에서 확인해요</span>
                  </>
                )}
              </div>
            </div>
            <div className="hstack gap-12">
              <Icon name="people" strokeWidth={1.8} color="var(--muted)" />
              <AvatarStack members={getMembers(meeting.attendeeIds)} size={30} />
              <span className="t-13 t-muted">{meeting.attendeeIds.length}명 참석</span>
            </div>
            <div style={{ height: 1, background: "var(--line)" }} />
            <div className="stack gap-8">
              <span className="t-13 t-strong">안건</span>
              <ol className="stack gap-4 t-14" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.5 }}>
                {meeting.agenda.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {online ? null : (
          <section className="card" style={{ borderRadius: 16, padding: 16 }}>
            <span className="t-13 t-strong">내 이동 경로</span>
            <div className="hstack gap-10 t-14">
              <span>{meeting.myRoute?.from}</span>
              <Icon name="arrowRight" size={18} strokeWidth={2} color="var(--muted)" />
              <span>{meeting.myRoute?.to}</span>
              <span className="t-13 t-muted" style={{ marginLeft: "auto" }}>
                약 {myTravel}분
              </span>
            </div>
            <span className="t-12 t-muted">{leaveAt(times.startMin, myTravel)} 출발 권장 · 전날과 당일 알림</span>
          </section>
        )}

        <div className="no-shrink" style={{ display: "grid", gridTemplateColumns: online ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <button type="button" className="btn btn--ghost t-13" style={{ height: 72, flexDirection: "column", border: "1px solid var(--line)", fontSize: 13 }} onClick={addToCalendar}>
            <Icon name="calendarAdd" strokeWidth={1.8} />
            캘린더 추가
          </button>
          {online ? null : (
            <a
              href={`https://map.kakao.com/link/search/${encodeURIComponent(placeName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--ghost"
              style={{ height: 72, flexDirection: "column", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink)" }}
            >
              <Icon name="navigate" strokeWidth={1.8} />
              길찾기
            </a>
          )}
        </div>

        {online || !place ? null : (
          <a href={place.url} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--lg no-shrink">
            장소 사이트에서 예약하기
            <Icon name="external" size={16} strokeWidth={2.2} />
          </a>
        )}
        <button type="button" className="btn no-shrink t-14 t-muted" style={{ height: 40, background: "none", fontWeight: 400, fontSize: 14 }} onClick={() => setSheet("absent")}>
          참석이 어려워요
        </button>
      </div>

      {sheet === "absent" ? (
        // 데모에서는 서연님 화면으로 보여줘요
        <AbsentSheet onClose={() => setSheet(null)} dayLabel={meeting.shortLabel.split(" ")[0]} viewerName={getMember("u-seoyeon").name} ownerName={owner.name} chatHref={chatHref} />
      ) : null}
    </main>
  );
}
