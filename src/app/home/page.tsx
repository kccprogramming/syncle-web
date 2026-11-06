"use client";

/**
 * 1 홈 — 다가오는 회의와 내 팀 목록.
 * ?empty=1 이면 1-0 빈 홈(처음 로그인해서 팀이 없을 때)을 보여줘요.
 * 로그인했으면 내 진짜 팀(A · Supabase)을 보여주고, 팀이 없으면 1-0이에요.
 * 로그인했으면 다가오는 회의도 내 팀들의 진짜 제안 · 확정 회의(C)를 보여줘요.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { TeamBadge } from "@/components/Avatar";
import { HomeHeader } from "@/components/home/HomeHeader";
import { useDemo, useProposal } from "@/lib/demo-store";
import { countUnreadNotifications, getMeetings, getNotifications, getPlaces, getTeam, getTeams, loadMyTeams, loadUpcoming, seoulLabel, subscribeMyNotifications, type UpcomingItem } from "@/lib/data";
import type { Meeting, Team } from "@/types";
import { useAuthUser } from "@/lib/use-auth-user";
import { getChosenPlace, type PlacePick } from "@/components/chat/team-info";
import { demoDate, demoUpcoming } from "@/lib/demo-scheduling";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const user = useAuthUser();
  // 로그인한 사람의 진짜 팀. undefined = 불러오는 중
  const [liveTeams, setLiveTeams] = useState<Team[] | undefined>(undefined);
  const [liveUpcoming, setLiveUpcoming] = useState<UpcomingItem[] | null>(null);
  const [liveUnread, setLiveUnread] = useState(0);
  // 진짜 알림: 안 읽은 수 + 새 알림이 오면 다시 세요
  useEffect(() => {
    if (!user) return;
    const recount = () => void countUnreadNotifications().then((n) => setLiveUnread(n ?? 0));
    recount();
    return subscribeMyNotifications(user.id, recount);
  }, [user]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!user) return;
    loadMyTeams()
      .then((t) => {
        setLiveTeams(t ?? []);
        // 팀 목록을 먼저 보여주고, 다가오는 회의는 이어서 불러와요
        loadUpcoming(t ?? [])
          .then(setLiveUpcoming)
          .catch(() => setLiveUpcoming([]));
      })
      .catch(() => setFailed(true));
  }, [user]);

  if (user === undefined) return null; // 로그인 확인 중
  if (!user) return sp.get("empty") === "1" ? <EmptyHome /> : <FullHome />; // 데모
  if (failed) return <FullHome live={[]} error="팀 목록을 불러오지 못했어요 · 새로고침해 주세요" />;
  if (liveTeams === undefined) return null;
  return liveTeams.length === 0 ? <EmptyHome /> : <FullHome live={liveTeams} liveUpcoming={liveUpcoming} liveUnread={liveUnread} />;
}

/* ───────── 1 홈 ───────── */

/** live: 로그인한 사람의 진짜 팀 (없으면 데모) */
function FullHome({ live, liveUpcoming, liveUnread = 0, error }: { live?: Team[]; liveUpcoming?: UpcomingItem[] | null; liveUnread?: number; error?: string }) {
  const { state } = useDemo();
  const teams = live ?? getTeams();

  // 데모의 다가오는 회의 (로그인했으면 없음) — 날짜는 오늘 기준
  // p-1은 데모 일정(demo-scheduling)에서: 눌러서 열리는 5 · 8 화면과 같은 날짜 · 확정 상태
  const [demoP1, setDemoP1] = useState(() => demoUpcoming(true));
  useEffect(() => setDemoP1(demoUpcoming()), []);
  const demoOthers = live ? [] : getMeetings().filter((m) => m.status === "upcoming" && !m.proposalId).map(shiftToToday);
  // 팀 목록의 한 줄('회의 확정 · 11/7(토) 15:00')도 같은 날짜로
  const teamNote = (t: Team) => {
    const note = t.homeNote ?? t.lastMessage;
    const m = demoOthers.find((x) => x.meeting.teamId === t.id);
    return m ? note.replace(m.original, m.meeting.shortLabel) : note;
  };
  const demoItems = [
    ...(live ? [] : [{ at: Date.parse(demoP1.startAt ?? demoP1.responseDeadline), el: <LiveMeetingCard key="p-1" item={demoP1} /> }]),
    ...demoOthers.map((m) => ({ at: m.at, el: <MeetingCard key={m.meeting.id} meeting={m.meeting} confirmed={false} pick={state} /> })),
  ].sort((a, b) => a.at - b.at);

  // 안 읽은 알림 수 (모두 읽음을 누르면 0)
  const unread = live ? liveUnread : state.notificationsRead ? 0 : getNotifications().filter((n) => n.unread).length;

  return (
    <main className="screen">
      <HomeHeader unreadCount={unread} />

      <div className="screen__body" style={{ gap: 20 }}>
        <section className="stack gap-10">
          <h2 className="t-14 t-strong t-ink2">다가오는 회의</h2>
          {live ? (
            liveUpcoming === null || liveUpcoming === undefined ? (
              <p className="t-13 t-muted">불러오는 중…</p>
            ) : liveUpcoming.length === 0 ? (
              <p className="t-13 t-muted">아직 다가오는 회의가 없어요 · 대화방에서 ‘@AI 회의 잡아줘’로 시작해요</p>
            ) : (
              liveUpcoming.map((u) => <LiveMeetingCard key={u.proposalId} item={u} />)
            )
          ) : null}
          {demoItems.map((i) => i.el)}
        </section>

        <section className="stack gap-10">
          <h2 className="t-14 t-strong t-ink2">내 팀</h2>
          {error && <p className="t-13 t-warn">{error}</p>}
          {teams.map((t) => (
            <Link key={t.id} href={`/teams/${t.id}`} className="card" style={{ flexDirection: "row", alignItems: "center", gap: 12, color: "var(--ink)" }}>
              <TeamBadge initial={t.initial} color={t.color} ink={t.ink} size={44} />
              <div className="stack grow" style={{ gap: 3 }}>
                <span className="t-15 t-strong">{t.name}</span>
                <span className="t-13 t-muted t-ellipsis">{teamNote(t)}</span>
              </div>
              {t.unread > 0 && (
                <span
                  className="no-shrink"
                  aria-label={`안 읽은 메시지 ${t.unread}개`}
                  style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "var(--accent)", borderRadius: 10, padding: "2px 8px" }}
                >
                  {t.unread}
                </span>
              )}
            </Link>
          ))}
        </section>
      </div>

      <footer className="footer footer--bare" style={{ paddingBottom: 24 }}>
        <Link href="/teams/new" className="btn btn--primary btn--lg btn--block" style={{ gap: 8 }}>
          <Icon name="plus" size={18} strokeWidth={2.2} />
          새 팀 만들기
        </Link>
        <Link href="/join" className="btn btn--ghost btn--block" style={{ color: "var(--ink)" }}>
          초대 링크로 참여하기
        </Link>
      </footer>
    </main>
  );
}

/** 진짜 팀의 다가오는 회의 한 장 (확정 회의 · 응답 받는 중인 제안) → C 화면 */
function LiveMeetingCard({ item }: { item: UpcomingItem }) {
  const d = item.startAt ? new Date(Date.parse(item.startAt) + 9 * 3600_000) : null; // 서울 날짜
  const confirmed = item.kind === "confirmed";
  // "11/10(화) 16:00" → "화 16:00" (날짜는 왼쪽 네모에 있어요)
  const when = item.startAt ? seoulLabel(item.startAt).replace(/^\d+\/\d+\((.)\)\s*/, "$1 ") : "";
  return (
    <Link
      href={confirmed ? `/meetings/${item.proposalId}` : `/proposals/${item.proposalId}`}
      className={`card${confirmed ? "" : " card--accent"}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, color: "var(--ink)" }}
    >
      <div
        className="stack no-shrink"
        style={{ width: 48, height: 52, borderRadius: 10, background: confirmed ? "var(--ok-bg)" : "var(--accent-soft)", color: confirmed ? "var(--ok)" : "var(--accent-strong)", alignItems: "center", justifyContent: "center" }}
      >
        {d ? (
          <>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{d.getUTCMonth() + 1}월</span>
            <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>{d.getUTCDate()}</span>
          </>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700 }}>미정</span>
        )}
      </div>
      <div className="stack gap-2 grow" style={{ minWidth: 0 }}>
        <span className="t-15 t-strong t-ellipsis">{item.title}</span>
        <span className="t-12 t-muted t-ellipsis">
          {confirmed ? `${when}${item.placeName ? ` · ${item.placeName}` : ""}` : when ? `AI 추천 ${when}` : "시간 후보를 모으는 중"} · {item.teamName}
        </span>
        {confirmed ? (
          <span className="tag tag--ok" style={{ alignSelf: "flex-start", marginTop: 2 }}>확정</span>
        ) : (
          <span className="tag tag--warn" style={{ alignSelf: "flex-start", marginTop: 2 }}>
            {item.needsMe ? "내 응답 필요 · " : ""}응답 마감 {seoulLabel(item.responseDeadline)} · {item.respondedCount}/{item.totalCount}명
          </span>
        )}
      </div>
      <span style={{ fontSize: 16, color: "var(--disabled)" }}>›</span>
    </Link>
  );
}

/**
 * 데모 회의(예: 주말합주 '11/7(토) 15:00')를 오늘 기준 날짜로 옮겨요.
 * 예시 데이터의 기준일 11/6에서 며칠 뒤였는지를 그대로 지켜요 (11/7 → 내일).
 */
const DEMO_BASE = Date.UTC(2026, 10, 6);
function shiftToToday(m: Meeting): { meeting: Meeting; at: number; original: string } {
  const original = m.shortLabel;
  const match = original.match(/^(\d+)\/(\d+)\(.\)\s*(\d\d:\d\d)/);
  if (!match) return { meeting: m, at: Infinity, original };
  const offset = Math.round((Date.UTC(2026, +match[1] - 1, +match[2]) - DEMO_BASE) / 86_400_000);
  const iso = demoDate(offset, match[3]);
  const label = seoulLabel(iso); // "11/7(토) 15:00"
  const [month, day] = label.split(/[/(]/);
  return { meeting: { ...m, shortLabel: label, month: `${month}월`, day }, at: Date.parse(iso), original };
}

/** "11/7(토) 15:00" → "토 15:00" */
function weekdayTime(shortLabel: string) {
  const match = shortLabel.match(/\((.)\)\s*(\S+)/);
  return match ? `${match[1]} ${match[2]}` : shortLabel;
}

/** 다가오는 회의 한 장 */
function MeetingCard({ meeting, confirmed, pick }: { meeting: Meeting; confirmed: boolean; pick: PlacePick }) {
  const team = getTeam(meeting.teamId);
  const when = weekdayTime(meeting.shortLabel);

  // 날짜 네모
  const dateBox = (
    <div
      className="stack no-shrink"
      style={{ width: 48, height: 52, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-strong)", alignItems: "center", justifyContent: "center" }}
    >
      <span style={{ fontSize: 11, fontWeight: 600 }}>{meeting.month}</span>
      <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>{meeting.day}</span>
    </div>
  );
  const rowStyle: React.CSSProperties = { flexDirection: "row", alignItems: "center", gap: 14, color: "var(--ink)" };

  // 제안에서 나온 회의가 아니면 (예: 주말합주) 이미 정해진 회의라 그냥 보여줘요
  if (!meeting.proposalId) {
    return (
      <div className="card" style={rowStyle}>
        {dateBox}
        <div className="stack gap-2 grow">
          <span className="t-15 t-strong">{meeting.title}</span>
          <span className="t-12 t-muted">
            {when} · {meeting.placeName} · {team.name}
          </span>
        </div>
      </div>
    );
  }

  // 확정 전: 응답 받는 중인 제안으로 / 확정 후: 확정 회의 카드로
  if (confirmed) {
    const place = getChosenPlace(meeting.proposalId, pick);
    return (
      <Link href={`/meetings/${meeting.id}`} className="card" style={rowStyle}>
        {dateBox}
        <div className="stack gap-2 grow" style={{ minWidth: 0 }}>
          <span className="t-15 t-strong">{meeting.title}</span>
          <span className="t-12 t-muted t-ellipsis">
            {when} · {place?.short ?? meeting.placeName} · {team.name}
          </span>
          <span className="tag tag--ok" style={{ alignSelf: "flex-start", marginTop: 2 }}>확정</span>
        </div>
        <span style={{ fontSize: 16, color: "var(--disabled)" }}>›</span>
      </Link>
    );
  }

  const proposal = useProposal(meeting.proposalId);
  const total = proposal.respondedIds.length + proposal.pendingIds.length;
  return (
    <Link href={`/proposals/${proposal.id}`} className="card card--accent" style={rowStyle}>
      {dateBox}
      <div className="stack gap-2 grow" style={{ minWidth: 0 }}>
        <span className="t-15 t-strong">{meeting.title}</span>
        <span className="t-12 t-muted t-ellipsis">
          AI 추천 {when} · {team.name}
        </span>
        <span className="tag tag--warn" style={{ alignSelf: "flex-start", marginTop: 2 }}>
          응답 마감 {proposal.deadline} · {proposal.respondedIds.length}/{total}명
        </span>
      </div>
      <span style={{ fontSize: 16, color: "var(--disabled)" }}>›</span>
    </Link>
  );
}

/* ───────── 1-0 빈 홈 ───────── */

const HOW_TO: React.ReactNode[] = [
  "팀 대화방에서 평소처럼 대화해요",
  <>
    <span className="t-bold" style={{ color: "var(--accent-strong)" }}>@AI 회의 잡아줘</span>라고 보내요
  </>,
  "AI가 모두에게 맞는 시간과 장소를 추천해요",
];

function EmptyHome() {
  // 빈 동그라미 두 개 + 파란 + (팀원이 아직 없다는 그림)
  const ring: React.CSSProperties = { width: 52, height: 52, borderRadius: 26, border: "2px dashed var(--disabled)", background: "var(--surface)" };

  return (
    <main className="screen">
      <HomeHeader />

      <div className="screen__body" style={{ padding: "24px 20px", justifyContent: "center", gap: 24 }}>
        <div className="stack t-center" style={{ alignItems: "center", gap: 14 }}>
          <div aria-hidden="true" className="hstack">
            <div style={ring} />
            <div style={{ ...ring, marginLeft: -12 }} />
            <div
              className="hstack"
              style={{ width: 52, height: 52, borderRadius: 26, background: "var(--accent)", color: "#fff", fontSize: 26, justifyContent: "center", marginLeft: -12 }}
            >
              +
            </div>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>아직 참여한 팀이 없어요</h1>
          <p className="t-14 t-ink2" style={{ lineHeight: 1.6 }}>
            팀을 만들어 초대 링크를 보내거나,
            <br />
            받은 초대 링크로 참여해 보세요.
          </p>
        </div>

        <section className="card" style={{ padding: 16, gap: 14 }}>
          <span className="section-label">싱클은 이렇게 써요</span>
          {HOW_TO.map((text, i) => (
            <div key={i} className="hstack gap-12" style={{ alignItems: "flex-start" }}>
              <span
                className="hstack no-shrink"
                style={{ width: 26, height: 26, borderRadius: 13, background: "var(--accent-soft)", color: "var(--accent-strong)", fontSize: 13, fontWeight: 700, justifyContent: "center" }}
              >
                {i + 1}
              </span>
              <span className="t-14" style={{ lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}
        </section>
      </div>

      <footer className="footer footer--bare" style={{ paddingBottom: 24 }}>
        <Link href="/teams/new" className="btn btn--primary btn--lg btn--block">
          새 팀 만들기
        </Link>
        <Link href="/join" className="btn btn--ghost btn--block" style={{ color: "var(--ink)" }}>
          초대 링크로 참여하기
        </Link>
      </footer>
    </main>
  );
}
