"use client";

/**
 * 3-2-1~3 팀 메뉴 전체 보기 (/teams/[teamId]/all?tab=meet|files|tasks)
 * 회의 · 자료 · 할 일을 탭으로 나눠 보여 줘요.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { CheckBox } from "@/components/Controls";
import { getFiles, getMember, getTeam } from "@/lib/data";
import { useDemo } from "@/lib/demo-store";
import type { TeamFile } from "@/types";
import { DEMO_TEAM_ID, getChosenPlace, getTeamMeetings, getTeamTaskViews, meetingLine, respondedText } from "@/components/chat/team-info";

type Tab = "meet" | "files" | "tasks";
type FileFilter = "all" | TeamFile["kind"];

/** 파일 종류별 아이콘 색 [배경, 글자] */
const EXT_COLORS: Record<TeamFile["ext"], [string, string]> = {
  PPT: ["#FDECE4", "#8A3F06"],
  PDF: ["#FBE4E4", "#8A1F1F"],
  AI: ["var(--accent-soft)", "var(--accent-strong)"],
  링크: ["var(--line-2)", "var(--ink-2)"],
  사진: ["var(--ok-bg)", "var(--ok)"],
};

const FILTERS: { id: FileFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "file", label: "파일" },
  { id: "photo", label: "사진" },
  { id: "link", label: "링크" },
];

export default function TeamAllPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { teamId } = useParams<{ teamId: string }>();
  const sp = useSearchParams();
  const { state, update } = useDemo();
  const team = getTeam(teamId);

  const startTab = sp.get("tab");
  const [tab, setTab] = useState<Tab>(startTab === "files" || startTab === "tasks" ? startTab : "meet");
  const [filter, setFilter] = useState<FileFilter>("all");

  const isDemo = teamId === DEMO_TEAM_ID;
  const meetings = getTeamMeetings(teamId, isDemo && state.confirmed);
  const files = getFiles(teamId);
  const { list: tasks, suggestion } = getTeamTaskViews(teamId, state);

  const tabs: { id: Tab; label: string }[] = [
    { id: "meet", label: `회의 ${(meetings.proposal ? 1 : 0) + meetings.upcoming.length + meetings.past.length}` },
    { id: "files", label: `자료 ${files.length}` },
    { id: "tasks", label: `할 일 ${tasks.length}` },
  ];

  const toggleTask = (id: string, done: boolean) => {
    if (isDemo) update((s) => ({ taskDone: { ...s.taskDone, [id]: !done } }));
  };

  return (
    <main className="screen">
      <header className="no-shrink" style={{ background: "var(--surface)" }}>
        <TopBar plain back={`/teams/${teamId}?menu=1`} backLabel="팀 메뉴로" title="팀 메뉴" sub={team.name} />
        <div role="tablist" className="hstack" style={{ borderBottom: "1px solid var(--line)" }}>
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.id)}
                className="t-14"
                style={{
                  flex: "1 1 0",
                  height: 46,
                  border: 0,
                  borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                  background: "none",
                  fontWeight: on ? 700 : 400,
                  color: on ? "var(--accent-strong)" : "var(--muted)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="screen__body" role="tabpanel">
        {/* ── 회의 탭 ── */}
        {tab === "meet" ? (
          <>
            <span className="section-label">진행 중</span>
            {meetings.proposal ? (
              <Link href={`/proposals/${meetings.proposal.id}`} className="card card--accent" style={{ gap: 6, color: "var(--ink)" }}>
                <span className="hstack gap-8">
                  <span className="t-15 t-strong grow">{meetings.proposal.title}</span>
                  <span className="tag tag--warn">응답 받는 중</span>
                </span>
                <span className="t-13 t-ink2">
                  AI 추천 {meetings.proposal.cardSummary.timeLabel} · {getChosenPlace(meetings.proposal.id, state).short}
                </span>
                <span className="t-12 t-muted">
                  응답 마감 {meetings.proposal.deadline} · {respondedText(meetings.proposal, state)} 응답
                </span>
              </Link>
            ) : null}
            {meetings.upcoming.map((m) => (
              <Link key={m.id} href={`/meetings/${m.id}`} className="card" style={{ gap: 6, color: "var(--ink)", border: "1.5px solid var(--ok)" }}>
                <span className="hstack gap-8">
                  <span className="t-15 t-strong grow">{m.title}</span>
                  <span className="tag tag--ok">확정</span>
                </span>
                <span className="t-13 t-ink2">{meetingLine(m, state)}</span>
                <span className="t-12 t-muted">{m.attendeeIds.length}명 참석</span>
              </Link>
            ))}
            {!meetings.proposal && meetings.upcoming.length === 0 ? <span className="t-13 t-muted">진행 중인 회의가 없어요</span> : null}

            {meetings.past.length ? (
              <span className="section-label" style={{ marginTop: 4 }}>
                지난 회의
              </span>
            ) : null}
            {meetings.past.map((m) => (
              <Link key={m.id} href={`/meetings/${m.id}/minutes`} className="card" style={{ flexDirection: "row", alignItems: "center", gap: 12, color: "var(--ink)" }}>
                <div className="stack no-shrink" style={{ width: 44, height: 48, borderRadius: 10, background: "var(--line-2)", color: "var(--ink-2)", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 11 }}>{m.month}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{m.day}</span>
                </div>
                <div className="stack gap-2 grow">
                  <span className="t-14 t-strong">{m.title}</span>
                  <span className="t-12 t-muted">{m.pastMeta}</span>
                </div>
                <span className="t-12 t-accent no-shrink">회의록 ›</span>
              </Link>
            ))}
          </>
        ) : null}

        {/* ── 자료 탭 ── */}
        {tab === "files" ? (
          <>
            <div className="hstack gap-8">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  className={`chip${filter === f.id ? " chip--on" : ""}`}
                  style={{ minHeight: 34 }}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="card card--flush" style={{ padding: "4px 16px" }}>
              {files
                .filter((f) => filter === "all" || f.kind === filter)
                .map((f) => (
                  <div key={f.id} className="hstack gap-12" style={{ minHeight: 60, borderBottom: "1px solid var(--line-2)" }}>
                    <div
                      className="no-shrink"
                      style={{ width: 38, height: 38, borderRadius: 10, background: EXT_COLORS[f.ext][0], color: EXT_COLORS[f.ext][1], fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {f.ext}
                    </div>
                    <div className="stack grow" style={{ gap: 1 }}>
                      <span className="t-14 t-ellipsis">{f.name}</span>
                      <span className="t-12 t-muted">{f.meta}</span>
                    </div>
                  </div>
                ))}
              {files.length === 0 ? <span className="t-13 t-muted" style={{ padding: "16px 0" }}>아직 모인 자료가 없어요</span> : null}
            </div>
            <span className="t-12 t-muted t-center">대화방에 올린 파일·사진·링크가 여기에 자동으로 모여요</span>
          </>
        ) : null}

        {/* ── 할 일 탭 ── */}
        {tab === "tasks" ? (
          <>
            {suggestion ? (
              <div className="hstack gap-10 no-shrink" style={{ background: "var(--accent-softer)", border: "1px solid var(--accent-line)", borderRadius: 14, padding: "12px 14px" }}>
                <span className="t-13 grow" style={{ lineHeight: 1.5, color: "var(--accent-ink)" }}>
                  AI가 대화에서 찾은 할 일
                  <br />
                  <strong>
                    {suggestion.title} · {getMember(suggestion.assigneeId).name}
                  </strong>
                </span>
                <button type="button" className="btn btn--primary btn--sm" style={{ fontWeight: 600 }} onClick={() => update({ aiTaskAdded: true })}>
                  추가
                </button>
              </div>
            ) : null}

            {[
              { title: "내 할 일", items: tasks.filter((t) => t.mine) },
              { title: "팀 할 일", items: tasks.filter((t) => !t.mine) },
            ].map((g) => (
              <div key={g.title} className="stack gap-8">
                <span className="section-label">{g.title}</span>
                <div className="card card--flush" style={{ padding: "4px 16px" }}>
                  {g.items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={t.done}
                      onClick={() => toggleTask(t.id, t.done)}
                      className="hstack gap-12"
                      style={{ minHeight: 56, padding: "6px 0", border: 0, borderBottom: "1px solid var(--line-2)", background: "none", textAlign: "left" }}
                    >
                      <CheckBox on={t.done} />
                      <span className="stack grow" style={{ gap: 1 }}>
                        <span className="t-14" style={{ color: t.done ? "var(--muted)" : "var(--ink)", textDecoration: t.done ? "line-through" : "none" }}>
                          {t.title}
                        </span>
                        <span className="t-12 t-muted">{t.meta}</span>
                      </span>
                    </button>
                  ))}
                  {g.items.length === 0 ? <span className="t-13 t-muted" style={{ padding: "16px 0" }}>할 일이 없어요</span> : null}
                </div>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </main>
  );
}
