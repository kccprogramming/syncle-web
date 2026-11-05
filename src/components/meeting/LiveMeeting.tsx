"use client";

/**
 * 8 확정 회의 카드 — 진짜 팀 (C 제안이 확정됐을 때). 주소: /meetings/{제안 ID}
 *
 * C 제안(GET /api/scheduling/proposals/{id})의 meeting(시간 · 장소 · 참석자 · 회의 링크),
 * 목적 · 안건(conditions), 장소 찾기 결과(placeResults)의 내 대중교통 시간으로 그려요.
 * 아직 확정 전이면 회의 제안 화면(5)으로 보내요.
 * '참석이 어려워요'는 대화방에 한 줄을 남겨 방장과 팀에게 알려요 (이유는 남기지 않아요).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { AvatarStack } from "@/components/Avatar";
import { StatusPill } from "@/components/meeting/StatusPill";
import { AbsentSheet } from "@/components/meeting/AbsentSheet";
import { CalendarSheet } from "@/components/meeting/CalendarSheet";
import { Toast, useToast } from "@/components/Toast";
import { getMember, getMembers, loadTeam, loadTeamMembers, myUserId, seoulLabel, sendTeamMessage } from "@/lib/data";
import { schedulingRequest, type LiveProposal } from "@/lib/scheduling-client";

/** ISO 시각 → 캘린더용 서울 시각 "20261110T160000" */
function icsTime(iso: string) {
  return new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 19).replace(/[-:]/g, "");
}

/** 서울 시각 "HH:mm"에서 이동 시간을 빼고 10분 단위로 내림 */
function leaveAt(startIso: string, travelMin: number) {
  const t = new Date(Date.parse(startIso) + 9 * 3600_000 - travelMin * 60_000);
  const m = Math.floor(t.getUTCMinutes() / 10) * 10;
  return `${t.getUTCHours()}:${String(m).padStart(2, "0")}`;
}

/** 링크는 http(s)만 열어요 */
const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null);

export function LiveMeeting({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<LiveProposal | null>(null);
  const [teamName, setTeamName] = useState("");
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [absent, setAbsent] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [, setNamesVersion] = useState(0);

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const p = await schedulingRequest<LiveProposal>(`proposals/${proposalId}`);
        if (gone) return;
        if (!p.meeting) return router.replace(`/proposals/${proposalId}`); // 아직 확정 전
        setData(p);
        setMeId(p.viewerId || (await myUserId()));
        const [team] = await Promise.all([loadTeam(p.teamId), loadTeamMembers(p.memberIds)]);
        if (gone) return;
        setTeamName(team?.name ?? "");
        setNamesVersion((v) => v + 1);
      } catch (e) {
        if (!gone) setError(e instanceof Error ? e.message : "회의를 불러오지 못했어요");
      }
    })();
    return () => {
      gone = true;
    };
  }, [proposalId, router]);

  if (error || !data || !data.meeting) {
    return (
      <main className="screen">
        <TopBar back="/home" backLabel="홈으로" title="회의 카드" />
        <div className="screen__body" style={{ alignItems: "center", justifyContent: "center" }}>
          <span className={`t-13 ${error ? "t-warn" : "t-muted"}`}>{error || "불러오는 중…"}</span>
        </div>
      </main>
    );
  }

  const meeting = data.meeting;
  const online = meeting.mode === "online";
  const chatHref = `/teams/${data.teamId}`;
  const ownerName = getMember(data.ownerId).name === "?" ? "방장" : getMember(data.ownerId).name;
  const myName = meId && getMember(meId).name !== "?" ? getMember(meId).name : "나";
  const agenda = data.conditions.agenda ?? [];
  const placeUrl = safeUrl(meeting.place?.url);
  const meetingUrl = safeUrl(meeting.meetingUrl);
  // 장소 찾기 결과에서 확정한 장소의 내 대중교통 시간
  const placeInfo = meeting.place ? data.placeResults.flatMap((r) => r.places).find((p) => p.id === meeting.place!.id) : undefined;
  const myTravel = placeInfo?.travel.find((t) => t.memberId === meId)?.minutes ?? null;
  const attendees = getMembers(meeting.attendeeIds);
  const dayLabel = seoulLabel(meeting.startAt).split(" ")[0];
  const timeLabel = `${seoulLabel(meeting.startAt)}–${seoulLabel(meeting.endAt).split(" ")[1] ?? ""}`;

  const calendarEvent = {
    uid: meeting.id,
    title: data!.title,
    location: online ? meetingUrl ?? "온라인" : meeting.place?.name ?? "",
    start: icsTime(meeting.startAt),
    end: icsTime(meeting.endAt),
    description: [teamName, agenda.length ? `안건: ${agenda.join(", ")}` : "", "싱클에서 잡은 회의"].filter(Boolean).join(" · "),
  };

  return (
    <main className="screen">
      <TopBar back={chatHref} backLabel="대화방으로" title="회의 카드" right={<StatusPill tone="ok">확정</StatusPill>} />

      <div className="screen__body">
        <section className="card card--flush" style={{ borderRadius: 16, overflow: "hidden" }}>
          <div className="stack gap-6" style={{ background: "var(--accent)", color: "#fff", padding: 20 }}>
            <span className="t-13" style={{ opacity: 0.9 }}>
              {teamName}
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>{data.title}</h1>
            <span className="t-15" style={{ fontWeight: 500 }}>
              {timeLabel}
            </span>
          </div>
          <div className="stack" style={{ padding: "16px 20px", gap: 14 }}>
            <div className="hstack gap-12" style={{ alignItems: "flex-start" }}>
              <span style={{ marginTop: 2 }}>
                <Icon name={online ? "video" : "pin"} strokeWidth={1.8} color="var(--muted)" />
              </span>
              <div className="stack gap-2" style={{ minWidth: 0 }}>
                <span className="t-15 t-strong">{online ? "온라인 회의" : meeting.place?.name ?? "장소 미정"}</span>
                {online ? (
                  <span className="t-12 t-muted">{meetingUrl ? "아래 버튼으로 회의에 들어가요" : "방장이 회의 링크를 올려요"}</span>
                ) : (
                  <>
                    {placeInfo?.area ? <span className="t-12 t-muted">{placeInfo.area} 근처</span> : null}
                    <span className="t-12 t-muted">시설·요금·예약은 장소 사이트에서 확인해요</span>
                  </>
                )}
              </div>
            </div>
            <div className="hstack gap-12">
              <Icon name="people" strokeWidth={1.8} color="var(--muted)" />
              <AvatarStack members={attendees} size={30} />
              <span className="t-13 t-muted">{meeting.attendeeIds.length}명 참석</span>
            </div>
            {agenda.length ? (
              <>
                <div style={{ height: 1, background: "var(--line)" }} />
                <div className="stack gap-8">
                  <span className="t-13 t-strong">안건</span>
                  <ol className="stack gap-4 t-14" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.5 }}>
                    {agenda.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ol>
                </div>
              </>
            ) : null}
          </div>
        </section>

        {online ? null : (
          <section className="card" style={{ borderRadius: 16, padding: 16 }}>
            <span className="t-13 t-strong">내 이동</span>
            {myTravel !== null ? (
              <>
                <div className="hstack gap-10 t-14">
                  <span>내 출발지</span>
                  <Icon name="arrowRight" size={18} strokeWidth={2} color="var(--muted)" />
                  <span className="t-ellipsis">{meeting.place?.name}</span>
                  <span className="t-13 t-muted" style={{ marginLeft: "auto" }}>
                    대중교통 약 {myTravel}분
                  </span>
                </div>
                <span className="t-12 t-muted">{leaveAt(meeting.startAt, myTravel)} 출발 권장 · 예상 시간이에요</span>
              </>
            ) : (
              <span className="t-12 t-muted">이동 시간을 알 수 없어요 · 내 정보에서 출발하는 곳을 정해 두면 다음 회의부터 보여요</span>
            )}
          </section>
        )}

        <div className="no-shrink" style={{ display: "grid", gridTemplateColumns: online ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <button type="button" className="btn btn--ghost t-13" style={{ height: 72, flexDirection: "column", border: "1px solid var(--line)", fontSize: 13 }} onClick={() => setCalendarOpen(true)}>
            <Icon name="calendarAdd" strokeWidth={1.8} />
            캘린더 추가
          </button>
          {online ? null : (
            <a
              href={`https://map.kakao.com/link/search/${encodeURIComponent(meeting.place?.name ?? "")}`}
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

        {online ? (
          meetingUrl ? (
            <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--lg no-shrink">
              회의 들어가기
              <Icon name="external" size={16} strokeWidth={2.2} />
            </a>
          ) : null
        ) : placeUrl ? (
          <a href={placeUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--lg no-shrink">
            장소 사이트에서 예약하기
            <Icon name="external" size={16} strokeWidth={2.2} />
          </a>
        ) : null}

        <Link href={`/meetings/${proposalId}/minutes`} className="btn btn--ghost no-shrink t-14" style={{ height: 44, border: "1px solid var(--line)" }}>
          AI 회의록 정리 ›
        </Link>
        <button type="button" className="btn no-shrink t-14 t-muted" style={{ height: 40, background: "none", fontWeight: 400, fontSize: 14 }} onClick={() => setAbsent(true)}>
          참석이 어려워요
        </button>
      </div>

      {absent ? (
        <AbsentSheet
          onClose={() => setAbsent(false)}
          dayLabel={dayLabel}
          viewerName={myName}
          ownerName={ownerName}
          chatHref={chatHref}
          live
          onSend={async (way) => {
            await sendTeamMessage(
              data.teamId,
              `${dayLabel} ‘${data.title}’ 회의에 참석이 어려워요 · 일정이 생겼어요 · ${way === "redo" ? "다시 조율 부탁해요" : "저 빼고 진행해 주세요"}`,
            );
          }}
          onError={(m) => toast.show(m)}
        />
      ) : null}
      {calendarOpen ? <CalendarSheet event={calendarEvent} fileName={`syncle-${meeting.id}.ics`} onClose={() => setCalendarOpen(false)} /> : null}
      <Toast {...toast} />
    </main>
  );
}
