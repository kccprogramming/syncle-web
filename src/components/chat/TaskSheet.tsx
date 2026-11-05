"use client";

/**
 * 할 일 추가 시트 (진짜 팀 · A team_tasks)
 * + 메뉴의 '할 일', 전체 보기 할 일 탭의 '+ 할 일 추가'에서 열어요.
 * 무엇을 · 누가(선택) · 언제까지(선택)를 정해요.
 */
import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { createTeamTask, getMember, type LiveTask } from "@/lib/data";

export function TaskSheet({
  teamId,
  memberIds,
  meId,
  onClose,
  onCreated,
}: {
  teamId: string;
  memberIds: string[];
  /** 로그인한 나 (맡을 사람 기본값) */
  meId: string | null;
  onClose: () => void;
  onCreated: (task: LiveTask) => void;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(meId);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const t = title.trim();

  async function save() {
    if (!t || busy) return;
    setBusy(true);
    setError("");
    try {
      onCreated(await createTeamTask(teamId, { title: t, assigneeId, due: due || null }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "할 일을 추가하지 못했어요");
      setBusy(false);
    }
  }

  const chip = (id: string | null, label: string) => (
    <button
      key={id ?? "team"}
      type="button"
      aria-pressed={assigneeId === id}
      className={`chip${assigneeId === id ? " chip--on" : ""}`}
      style={{ minHeight: 34 }}
      onClick={() => setAssigneeId(id)}
    >
      {label}
    </button>
  );

  return (
    <Sheet open onClose={onClose} title="할 일 추가" sub="팀원 모두에게 보여요 · 다른 사람에게 맡기면 알림이 가요">
      <input
        className="input"
        type="text"
        autoFocus
        maxLength={100}
        aria-label="할 일"
        placeholder="할 일을 입력해주세요"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
        }}
      />
      <div className="stack gap-6">
        <span className="t-13 t-muted">누가 할까요?</span>
        <div className="hstack gap-8" style={{ flexWrap: "wrap" }}>
          {memberIds.map((id) => chip(id, id === meId ? "나" : getMember(id).name === "?" ? "팀원" : getMember(id).name))}
          {chip(null, "정하지 않음")}
        </div>
      </div>
      <label className="stack gap-6">
        <span className="t-13 t-muted">언제까지? (선택)</span>
        <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="마감 날짜" />
      </label>
      {error ? <span className="t-12 t-warn">{error}</span> : null}
      <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={!t || busy} onClick={() => void save()}>
        {busy ? "추가하는 중…" : "할 일 추가"}
      </button>
    </Sheet>
  );
}
