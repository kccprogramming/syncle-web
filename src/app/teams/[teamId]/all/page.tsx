"use client";

/**
 * 3-2-1~3 팀 메뉴 전체 보기 (/teams/[teamId]/all?tab=meet|photos|files|tasks)
 * 회의 · 사진 · 자료 · 할 일을 탭으로 나눠 보여 줘요.
 * 진짜 팀(A)이면 팀 이름 · 사진 · 자료를 Supabase에서 읽어요 (회의 · 할 일은 아직 데모 함수라 비어 있어요).
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { CheckBox } from "@/components/Controls";
import { getFiles, getMember, getTeam, loadTeam, loadTeamMaterials, loadTeamMembers, loadTeamTasks, materialUrl, myUserId, setTaskDone, type LiveTask } from "@/lib/data";
import { TaskSheet } from "@/components/chat/TaskSheet";
import { isLiveId } from "@/lib/scheduling-client";
import { useDemo } from "@/lib/demo-store";
import type { Team, TeamFile } from "@/types";
import { DEMO_TEAM_ID, getChosenPlace, getTeamMeetings, getTeamTaskViews, liveTaskViews, meetingLine, respondedText } from "@/components/chat/team-info";

type Tab = "meet" | "photos" | "files" | "tasks";
type FileFilter = "all" | TeamFile["kind"];

/** 파일 종류별 아이콘 색 [배경, 글자] */
const EXT_COLORS: Record<TeamFile["ext"], [string, string]> = {
  PPT: ["#FDECE4", "#8A3F06"],
  PDF: ["#FBE4E4", "#8A1F1F"],
  AI: ["var(--accent-soft)", "var(--accent-strong)"],
  링크: ["var(--line-2)", "var(--ink-2)"],
  사진: ["var(--ok-bg)", "var(--ok)"],
  파일: ["var(--line-2)", "var(--ink-2)"],
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
  // 진짜 팀(A): 팀 이름 · 팀원 · 자료를 불러와요
  const live = isLiveId(teamId);
  const [liveTeam, setLiveTeam] = useState<Team | null>(null);
  const [liveFiles, setLiveFiles] = useState<TeamFile[] | null>(null);
  const [liveTasks, setLiveTasks] = useState<LiveTask[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [taskSheet, setTaskSheet] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!live) return;
    let gone = false;
    loadTeam(teamId)
      .then(async (t) => {
        if (gone || !t) return;
        setLiveTeam(t);
        await loadTeamMembers(t.memberIds).catch(() => undefined); // 올린 사람 · 맡은 사람 이름
        const [list, tasks, id] = await Promise.all([loadTeamMaterials(teamId), loadTeamTasks(teamId).catch(() => []), myUserId()]);
        if (gone) return;
        setLiveFiles(list);
        setLiveTasks(tasks);
        setMeId(id);
      })
      .catch(() => !gone && setLiveFiles([]));
    return () => {
      gone = true;
    };
  }, [live, teamId]);
  const team = liveTeam ?? getTeam(teamId);

  const startTab = sp.get("tab");
  const [tab, setTab] = useState<Tab>(startTab === "files" || startTab === "tasks" || startTab === "photos" ? startTab : "meet");
  const [filter, setFilter] = useState<FileFilter>("all");

  const isDemo = teamId === DEMO_TEAM_ID;
  const meetings = getTeamMeetings(teamId, isDemo && state.confirmed, state.cProposal);
  const allFiles = live ? (liveFiles ?? []) : getFiles(teamId);
  const photos = allFiles.filter((f) => f.kind === "photo");
  // 진짜 팀은 사진을 사진 탭에 따로 모아요
  const files = live ? allFiles.filter((f) => f.kind !== "photo") : allFiles;
  /** 자료 열기 (진짜 팀): 새 탭을 먼저 열어 두고 주소를 넣어요 */
  const openMaterial = (f: TeamFile) => {
    if (!live) return;
    const w = window.open("", "_blank");
    materialUrl(f)
      .then((url) => {
        if (url && w) w.location.href = url;
        else {
          w?.close();
          setToast("파일을 열지 못했어요");
        }
      })
      .catch(() => {
        w?.close();
        setToast("파일을 열지 못했어요");
      });
  };
  const demoTasks = getTeamTaskViews(teamId, state);
  const tasks = live ? liveTaskViews(liveTasks ?? [], meId) : demoTasks.list;
  const suggestion = live ? null : demoTasks.suggestion;

  const tabs: { id: Tab; label: string }[] = [
    { id: "meet", label: `회의 ${(meetings.proposal ? 1 : 0) + meetings.upcoming.length + meetings.past.length}` },
    ...(live ? [{ id: "photos" as const, label: `사진 ${photos.length}` }] : []),
    { id: "files", label: `자료 ${files.length}` },
    { id: "tasks", label: `할 일 ${tasks.length}` },
  ];

  const toggleTask = (id: string, done: boolean) => {
    if (!live) {
      if (isDemo) update((s) => ({ taskDone: { ...s.taskDone, [id]: !done } }));
      return;
    }
    // 진짜 팀: 바로 바꿔 보여주고 저장해요 (실패하면 되돌려요)
    setLiveTasks((prev) => prev?.map((t) => (t.id === id ? { ...t, done: !done } : t)) ?? prev);
    setTaskDone(id, !done).catch(() => {
      setLiveTasks((prev) => prev?.map((t) => (t.id === id ? { ...t, done } : t)) ?? prev);
      setToast("할 일을 저장하지 못했어요");
    });
  };

  return (
    <main className="screen">
      <header className="no-shrink" style={{ background: "var(--surface)" }}>
        <TopBar plain back={`/teams/${teamId}?menu=1`} backLabel="팀 메뉴로" title="팀 메뉴" sub={live && !liveTeam ? "" : team.name} />
        {toast ? <p role="status" className="t-12 t-warn" style={{ padding: "0 16px 6px" }}>{toast}</p> : null}
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

        {/* ── 사진 탭 (진짜 팀) ── */}
        {tab === "photos" ? (
          <>
            {photos.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4 }}>
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={`${p.name} 사진 크게 보기 · ${p.meta}`}
                    onClick={() => openMaterial(p)}
                    style={{ aspectRatio: "1 / 1", border: 0, padding: 0, borderRadius: 6, overflow: "hidden", background: "var(--line-2)" }}
                  >
                    {p.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbUrl} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <span className="t-13 t-muted" style={{ padding: "16px 0" }}>{liveFiles === null ? "불러오는 중…" : "아직 올린 사진이 없어요"}</span>
            )}
            <span className="t-12 t-muted t-center">대화방에 올린 사진이 여기에 모여요 · 누르면 크게 보여요</span>
          </>
        ) : null}

        {/* ── 자료 탭 ── */}
        {tab === "files" ? (
          <>
            <div className="hstack gap-8">
              {FILTERS.filter((f) => !live || f.id !== "photo").map((f) => (
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
                  <div
                    key={f.id}
                    className="hstack gap-12"
                    style={{ minHeight: 60, borderBottom: "1px solid var(--line-2)", cursor: live ? "pointer" : undefined }}
                    role={live ? "button" : undefined}
                    tabIndex={live ? 0 : undefined}
                    onClick={live ? () => openMaterial(f) : undefined}
                    onKeyDown={live ? (e) => e.key === "Enter" && openMaterial(f) : undefined}
                  >
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
              {files.length === 0 ? <span className="t-13 t-muted" style={{ padding: "16px 0", display: "block" }}>{live && liveFiles === null ? "불러오는 중…" : "아직 모인 자료가 없어요"}</span> : null}
            </div>
            <span className="t-12 t-muted t-center">대화방에 올린 파일·사진·링크가 여기에 자동으로 모여요</span>
          </>
        ) : null}

        {/* ── 할 일 탭 ── */}
        {tab === "tasks" ? (
          <>
            {live && liveTeam ? (
              <button type="button" className="btn btn--ghost btn--block" style={{ height: 44 }} onClick={() => setTaskSheet(true)}>
                + 할 일 추가
              </button>
            ) : null}
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
                  {g.items.length === 0 ? (
                    <span className="t-13 t-muted" style={{ padding: "16px 0", display: "block" }}>{live && liveTasks === null ? "불러오는 중…" : "할 일이 없어요"}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </>
        ) : null}
      </div>
      {taskSheet && liveTeam ? (
        <TaskSheet
          teamId={liveTeam.id}
          memberIds={liveTeam.memberIds}
          meId={meId}
          onClose={() => setTaskSheet(false)}
          onCreated={(t) => {
            setLiveTasks((prev) => [t, ...(prev ?? [])]);
            setTaskSheet(false);
          }}
        />
      ) : null}
    </main>
  );
}
