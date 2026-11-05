"use client";

/** 9 AI 회의록 — 요약, 정한 것, 회의에서 나온 할 일(골라서 팀 할 일에 추가) */
import { useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { CheckBox } from "@/components/Controls";
import { Toast, useToast } from "@/components/Toast";
import { useDemo } from "@/lib/demo-store";
import { getMeeting, getMinutes } from "@/lib/data";

export default function MinutesPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { state, update } = useDemo();
  const toast = useToast();

  const minutes = getMinutes(meetingId);
  const meeting = getMeeting(minutes.meetingId);
  const added = state.minutesTasksAdded;

  // 고른 할 일 (처음엔 모두 고름)
  const [picked, setPicked] = useState<string[]>(minutes.tasks.map((t) => t.id));
  const count = picked.length;

  function toggle(id: string) {
    if (added) return; // 이미 추가했으면 바꿀 수 없어요
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function addTasks() {
    if (added || count === 0) return;
    update({ minutesTasksAdded: true });
    toast.show("팀 할 일에 추가하고 담당자에게 알렸어요");
  }

  let label = "추가할 할 일을 골라주세요";
  if (count > 0) label = `고른 ${count}개 팀 할 일에 추가`;
  if (added) label = "할 일에 추가했어요";

  return (
    <main className="screen">
      <TopBar
        back={`/teams/${meeting.teamId}/all?tab=meet`}
        backLabel="회의 목록으로"
        title="회의록"
        right={
          <button type="button" className="btn btn--sm btn--ghost" style={{ fontSize: 12, marginRight: 4 }} onClick={() => toast.show("준비 중이에요")}>
            수정
          </button>
        }
      />

      <div className="screen__body" style={{ padding: "14px 16px", gap: 10 }}>
        <section className="card gap-4">
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{minutes.title}</h1>
          <span className="t-13 t-muted">{minutes.meta}</span>
          <span className="t-12" style={{ color: "var(--accent-strong)", background: "var(--accent-soft)", borderRadius: 6, padding: "3px 8px", alignSelf: "flex-start", marginTop: 4 }}>
            싱클 AI가 회의 중 메모와 공유 자료로 정리했어요
          </span>
        </section>

        <section className="card gap-8">
          <h2 className="t-15 t-strong">세 줄 요약</h2>
          <ul className="stack gap-4 t-14" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
            {minutes.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section className="card gap-8">
          <h2 className="t-15 t-strong">정한 것</h2>
          {minutes.decided.map((d) => (
            <div key={d.text} className="hstack gap-10 t-14" style={{ alignItems: "flex-start", lineHeight: 1.5 }}>
              <span className="t-bold" style={{ color: d.settled ? "var(--ok)" : "var(--warn)" }} aria-label={d.settled ? "정함" : "아직 안 정함"}>
                {d.settled ? "✓" : "?"}
              </span>
              <span>{d.text}</span>
            </div>
          ))}
        </section>

        <section className="card gap-6">
          <div className="hstack">
            <h2 className="t-15 t-strong grow">회의에서 나온 할 일</h2>
            <span className="t-12 t-muted">{added ? "추가 완료" : `${count}개 선택`}</span>
          </div>
          {minutes.tasks.map((t) => {
            const on = picked.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                disabled={added}
                onClick={() => toggle(t.id)}
                className="hstack gap-10"
                style={{ minHeight: 48, padding: "4px 0", border: 0, background: "none", textAlign: "left", cursor: added ? "default" : "pointer" }}
              >
                <CheckBox on={on} />
                <span className="stack grow" style={{ gap: 1 }}>
                  <span className="t-14">{t.title}</span>
                  <span className="t-12 t-muted">{t.meta}</span>
                </span>
              </button>
            );
          })}
        </section>
      </div>

      <footer className="footer">
        <button type="button" className="btn btn--primary" disabled={added || count === 0} onClick={addTasks}>
          {label}
        </button>
      </footer>

      <Toast message={toast.message} bottom={96} />
    </main>
  );
}
