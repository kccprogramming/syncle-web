"use client";

/** 3-2 오른쪽에서 열리는 팀 메뉴(드로어). 확정 뒤에는 회의 카드가 초록색(3-4-1)으로 바뀌어요. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { AvatarStack } from "@/components/Avatar";
import { CheckBox, Switch } from "@/components/Controls";
import { Icon, type IconName } from "@/components/Icon";
import { getFiles, getMember, getMembers, loadTeamMaterials, loadTeamTasks, materialUrl, myUserId, setTaskDone, type LiveTask } from "@/lib/data";
import { isLiveId } from "@/lib/scheduling-client";
import { useDemo } from "@/lib/demo-store";
import type { Team, TeamFile } from "@/types";
import { DEMO_TEAM_ID, copyInviteLink, getTeamMeetings, getTeamTaskViews, liveTaskViews, meetingLine, respondedText } from "./team-info";

/** 섹션 제목 줄: "회의 2 ··· 전체 보기" */
function SectionHead({ title, count, href }: { title: string; count: number; href: string }) {
  return (
    <div className="hstack gap-6">
      <h2 className="t-15 t-bold">{title}</h2>
      <span className="t-13 t-muted">{count}</span>
      <Link href={href} className="t-12" style={{ marginLeft: "auto", padding: "4px 0" }}>
        전체 보기
      </Link>
    </div>
  );
}

const fileIcon: Record<TeamFile["kind"], IconName> = { file: "file", photo: "image", link: "link" };
/** 오른쪽 작은 표시: '새'(파랑) 또는 '확정'(초록) */
function Badge({ label, color = "var(--accent)" }: { label: string; color?: string }) {
  return (
    <span className="tag no-shrink" style={{ background: color, color: "#fff", borderRadius: 8 }}>
      {label}
    </span>
  );
}

export function TeamDrawer({
  open,
  onClose,
  team,
  confirmed,
  aiOn,
  onAiChange,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  team: Team;
  confirmed: boolean;
  aiOn: boolean;
  onAiChange: (on: boolean) => void;
  onToast: (text: string) => void;
}) {
  const { state, update } = useDemo();

  // Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 진짜 팀(A): 메뉴를 열 때마다 팀 자료를 새로 불러와요 (방금 올린 사진 · 파일도 보이게)
  const live = isLiveId(team.id);
  const [liveFiles, setLiveFiles] = useState<TeamFile[] | null>(null);
  const [liveTasks, setLiveTasks] = useState<LiveTask[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  // 메뉴를 열 때 이미 끝나 있던 할 일 (메뉴에는 안 보여요. 방금 체크한 건 줄 그은 채로 남아요)
  const [doneAtOpen, setDoneAtOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open || !live) return;
    let gone = false;
    loadTeamMaterials(team.id)
      .then((list) => !gone && setLiveFiles(list))
      .catch(() => !gone && setLiveFiles([]));
    Promise.all([myUserId(), loadTeamTasks(team.id)])
      .then(([id, list]) => {
        if (gone) return;
        setMeId(id);
        setLiveTasks(list);
        setDoneAtOpen(new Set(list.filter((t) => t.done).map((t) => t.id)));
      })
      .catch(() => !gone && setLiveTasks([]));
    return () => {
      gone = true;
    };
  }, [open, live, team.id]);

  if (!open) return null;

  const base = `/teams/${team.id}`;
  /** 자료 열기: 새 탭을 먼저 열어 두고 주소를 받아서 넣어요 (기다린 뒤 열면 막히는 브라우저가 있어요) */
  const openMaterial = (f: TeamFile) => {
    const tab = window.open("", "_blank");
    materialUrl(f)
      .then((url) => {
        if (url && tab) tab.location.href = url;
        else {
          tab?.close();
          onToast("파일을 열지 못했어요");
        }
      })
      .catch(() => {
        tab?.close();
        onToast("파일을 열지 못했어요");
      });
  };
  const meetings = getTeamMeetings(team.id, confirmed, state.cProposal);
  const lastPast = meetings.past[0];
  const allFiles = live ? (liveFiles ?? []) : getFiles(team.id);
  // 진짜 팀은 사진을 따로 모아 보여줘요
  const photos = live ? allFiles.filter((f) => f.kind === "photo") : [];
  const files = live ? allFiles.filter((f) => f.kind !== "photo") : allFiles;
  const isDemo = team.id === DEMO_TEAM_ID;
  const demoTasks = getTeamTaskViews(team.id, state);
  const tasks = live ? liveTaskViews(liveTasks ?? [], meId) : demoTasks.list;
  const suggestion = live ? null : demoTasks.suggestion;
  /** 할 일 체크 — 진짜 팀은 저장하고(실패하면 되돌려요), 데모 팀은 데모 상태에 */
  const toggleTask = (id: string, done: boolean) => {
    if (!live) return isDemo && update((s) => ({ taskDone: { ...s.taskDone, [id]: !done } }));
    setLiveTasks((prev) => prev?.map((t) => (t.id === id ? { ...t, done: !done } : t)) ?? prev);
    setTaskDone(id, !done).catch(() => {
      setLiveTasks((prev) => prev?.map((t) => (t.id === id ? { ...t, done } : t)) ?? prev);
      onToast("할 일을 저장하지 못했어요");
    });
  };
  // 드로어에는 아직 안 끝난 할 일만 (방금 체크한 건 줄이 그어진 채로 남아요)
  const openTasks = tasks.filter((t) => (live ? !doneAtOpen.has(t.id) : !t.wasDone));
  const meetingCount = (meetings.proposal ? 1 : 0) + meetings.upcoming.length + (lastPast ? 1 : 0);

  return (
    <>
      <button className="backdrop" aria-label="메뉴 닫기" onClick={onClose} />
      <aside
        aria-label="팀 메뉴"
        className="stack"
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 330, maxWidth: "88%", background: "var(--surface)", zIndex: 21, overflow: "hidden" }}
      >
        {/* 팀 이름 · 팀원 */}
        <div className="hstack no-shrink" style={{ padding: "14px 4px 12px 20px", alignItems: "flex-start", borderBottom: "1px solid var(--line)" }}>
          <div className="stack gap-10 grow" style={{ paddingTop: 8 }}>
            <div className="stack gap-2">
              <h1 style={{ fontSize: 17, fontWeight: 700 }}>{team.name}</h1>
              <span className="t-12 t-muted">
                {team.memberIds.length}명 · AI 도우미 {aiOn ? "켜짐" : "꺼짐"}
              </span>
            </div>
            <div className="hstack gap-8">
              <AvatarStack members={getMembers(team.memberIds)} size={28} />
              <button
                type="button"
                className="btn btn--ghost"
                style={{ height: 32, padding: "0 10px", borderRadius: 16, fontSize: 12, whiteSpace: "nowrap" }}
                onClick={() => {
                  copyInviteLink(team);
                  onToast("초대 링크가 복사되었어요");
                }}
              >
                + 초대 링크 복사
              </button>
            </div>
          </div>
          <Link href={`${base}/settings`} className="icon-btn" aria-label="팀 설정">
            <Icon name="settings" size={21} />
          </Link>
          <button type="button" className="icon-btn" aria-label="메뉴 닫기" onClick={onClose}>
            <Icon name="close" size={21} />
          </button>
        </div>

        <div className="stack grow" style={{ padding: "14px 16px", gap: 18, overflowY: "auto" }}>
          {/* 회의 */}
          <section className="stack gap-8">
            <SectionHead title="회의" count={meetingCount} href={`${base}/all?tab=meet`} />
            {meetings.proposal ? (
              <Link
                href={`/proposals/${meetings.proposal.id}`}
                className="hstack gap-10"
                style={{ border: "1.5px solid var(--accent)", background: "var(--accent-softer)", borderRadius: 12, padding: "10px 12px", color: "var(--ink)" }}
              >
                <div className="stack gap-2 grow">
                  <span className="t-14 t-strong">{meetings.proposal.title}</span>
                  <span className="t-12 t-ink2">
                    응답 마감 {meetings.proposal.deadline} · {respondedText(meetings.proposal, state)}
                  </span>
                </div>
                <Badge label="새" />
              </Link>
            ) : null}
            {meetings.upcoming.map((m) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="hstack gap-10"
                style={{ border: "1.5px solid var(--ok)", background: "var(--ok-bg-2)", borderRadius: 12, padding: "10px 12px", color: "var(--ink)" }}
              >
                <div className="stack gap-2 grow">
                  <span className="t-14 t-strong">{m.title}</span>
                  <span className="t-12 t-ink2">
                    {meetingLine(m, state)} · {m.attendeeIds.length}명
                  </span>
                </div>
                <Badge label="확정" color="var(--ok)" />
              </Link>
            ))}
            {lastPast ? (
              <Link
                href={`/meetings/${lastPast.id}/minutes`}
                className="stack gap-2"
                style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", color: "var(--ink)" }}
              >
                <span className="t-14 t-strong">{lastPast.title}</span>
                <span className="t-12 t-muted">
                  {lastPast.shortLabel.split(" ")[0]} · <span className="t-accent">AI 회의록 보기 ›</span>
                </span>
              </Link>
            ) : null}
            {meetingCount === 0 ? <span className="t-13 t-muted">아직 회의가 없어요 · 대화방에서 @AI로 잡아 보세요</span> : null}
          </section>

          {/* 사진 (진짜 팀) */}
          {live ? (
            <section className="stack gap-8">
              <SectionHead title="사진" count={photos.length} href={`${base}/all?tab=photos`} />
              {photos.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                  {photos.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-label={`${p.name} 사진 크게 보기`}
                      onClick={() => openMaterial(p)}
                      style={{ aspectRatio: "1 / 1", border: 0, padding: 0, borderRadius: 8, overflow: "hidden", background: "var(--line-2)" }}
                    >
                      {p.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbUrl} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <Icon name="image" size={18} />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="t-13 t-muted">{liveFiles === null ? "불러오는 중…" : "대화방에 올린 사진이 여기에 모여요"}</span>
              )}
            </section>
          ) : null}

          {/* 자료 */}
          <section className="stack gap-8">
            <SectionHead title="자료" count={files.length} href={`${base}/all?tab=files`} />
            {files.slice(0, 3).map((f) => (
              <div
                key={f.id}
                className="hstack gap-10"
                style={{ padding: "4px 0", cursor: live ? "pointer" : undefined }}
                role={live ? "button" : undefined}
                tabIndex={live ? 0 : undefined}
                onClick={live ? () => openMaterial(f) : undefined}
                onKeyDown={live ? (e) => e.key === "Enter" && openMaterial(f) : undefined}
              >
                <div
                  style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: f.isNew ? "var(--accent-soft)" : "var(--line-2)", color: f.isNew ? "var(--accent)" : "var(--ink-2)" }}
                >
                  <Icon name={fileIcon[f.kind]} size={18} strokeWidth={1.8} />
                </div>
                <div className="stack grow" style={{ gap: 1 }}>
                  <span className="t-14 t-ellipsis">{f.name}</span>
                  <span className="t-12 t-muted">{f.meta}</span>
                </div>
                {f.isNew ? <Badge label="새" /> : null}
              </div>
            ))}
            {files.length === 0 ? <span className="t-13 t-muted">{live && liveFiles === null ? "불러오는 중…" : "대화방에 올린 파일이 여기에 모여요"}</span> : null}
          </section>

          {/* 할 일 */}
          <section className="stack gap-8">
            <SectionHead title="할 일" count={openTasks.length + (suggestion ? 1 : 0)} href={`${base}/all?tab=tasks`} />
            {openTasks.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.done}
                className="hstack gap-10"
                style={{ minHeight: 40, border: 0, background: "none", padding: 0, textAlign: "left" }}
                onClick={() => toggleTask(t.id, t.done)}
              >
                <CheckBox on={t.done} />
                <span className="stack" style={{ gap: 1 }}>
                  <span className="t-14" style={{ textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--muted)" : "var(--ink)" }}>
                    {t.title}
                  </span>
                  <span className="t-12 t-muted">{t.meta.replace("(나)", "")}</span>
                </span>
              </button>
            ))}
            {suggestion ? (
              <div className="hstack gap-10" style={{ background: "var(--accent-softer)", borderRadius: 10, padding: "10px 12px" }}>
                <span className="t-12 grow" style={{ lineHeight: 1.5, color: "var(--accent-ink)" }}>
                  AI가 대화에서 할 일 1개를 찾았어요
                  <br />“{suggestion.title} · {getMember(suggestion.assigneeId).name}”
                </span>
                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ height: 32, padding: "0 12px", borderRadius: 16, fontSize: 12 }}
                  onClick={() => update({ aiTaskAdded: true })}
                >
                  추가
                </button>
              </div>
            ) : null}
            {openTasks.length === 0 && !suggestion ? (
              <span className="t-13 t-muted">{live && liveTasks === null ? "불러오는 중…" : live ? "아직 할 일이 없어요 · 대화방 + 메뉴에서 추가해요" : "아직 할 일이 없어요"}</span>
            ) : null}
          </section>
        </div>

        {/* AI 도우미 스위치 */}
        <div className="hstack gap-10 no-shrink" style={{ padding: "10px 20px 22px", borderTop: "1px solid var(--line)" }}>
          <span className="t-14 grow">AI 도우미</span>
          <span className="t-12" style={{ color: aiOn ? "var(--ok)" : "var(--muted)" }}>
            {aiOn ? "켜짐" : "꺼짐"}
          </span>
          <Switch on={aiOn} onChange={onAiChange} label="AI 도우미" />
        </div>
      </aside>
    </>
  );
}
