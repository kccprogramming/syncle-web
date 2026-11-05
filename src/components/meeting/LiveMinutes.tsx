"use client";

/**
 * 9 AI 회의록 — 진짜 팀 (C 제안이 확정된 회의). 주소: /meetings/{제안 ID}/minutes
 *
 * 입력(11/6 팀 결정): 직접 붙여 넣은 회의 메모 + 회의 시간 동안의 대화방 메시지. 녹음은 이번 범위에서 빼요.
 * B(성하)의 회의록 카드(minutes)로 요약 · 정한 것 · 할 일을 받아 보여줘요.
 * 회의록은 따로 저장하지 않아요 → '대화방에 올리기'로 팀에 남기고, 할 일은 골라서 팀 할 일로 추가해요.
 */
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { CheckBox } from "@/components/Controls";
import { Toast, useToast } from "@/components/Toast";
import { askTeamAi, createTeamTask, loadTeamMembers, seoulLabel, sendTeamMessage } from "@/lib/data";
import { schedulingRequest, type LiveProposal } from "@/lib/scheduling-client";
import type { AiReply } from "@/types";

type Item = AiReply["items"][number];

export function LiveMinutes({ proposalId }: { proposalId: string }) {
  const toast = useToast();
  const [data, setData] = useState<LiveProposal | null>(null);
  const [error, setError] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<AiReply | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [added, setAdded] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let gone = false;
    schedulingRequest<LiveProposal>(`proposals/${proposalId}`)
      .then(async (p) => {
        await loadTeamMembers(p.memberIds).catch(() => undefined);
        if (!gone) setData(p);
      })
      .catch((e) => !gone && setError(e instanceof Error ? e.message : "회의를 불러오지 못했어요"));
    return () => {
      gone = true;
    };
  }, [proposalId]);

  const meeting = data?.meeting;
  const back = data ? (meeting ? `/meetings/${proposalId}` : `/proposals/${proposalId}`) : "/home";

  if (!data || !meeting) {
    return (
      <main className="screen">
        <TopBar back={back} backLabel="회의 카드로" title="회의록" />
        <div className="screen__body" style={{ alignItems: "center", justifyContent: "center", padding: 24 }}>
          <span className={`t-13 t-center ${error ? "t-warn" : "t-muted"}`}>{error || (data ? "회의가 확정된 뒤에 회의록을 정리할 수 있어요" : "불러오는 중…")}</span>
        </div>
      </main>
    );
  }

  const when = `${seoulLabel(meeting.startAt)}–${seoulLabel(meeting.endAt).split(" ")[1] ?? ""}`;
  const items = reply?.items ?? [];
  const summary = items.filter((it) => !it.tag);
  const decided = items.filter((it) => it.tag === "정함" || it.tag === "미정");
  const tasks = items.map((it, i) => ({ it, i })).filter(({ it }) => it.tag === "할 일");

  async function run() {
    setBusy(true);
    try {
      // 회의 시간 앞뒤 30분까지의 대화를 같이 읽어요
      const pad = 30 * 60_000;
      const r = await askTeamAi(data!.teamId, "@AI 회의록 정리해줘", {
        memo: memo.trim() || undefined,
        window: { startAt: new Date(Date.parse(meeting!.startAt) - pad).toISOString(), endAt: new Date(Date.parse(meeting!.endAt) + pad).toISOString() },
      });
      setReply(r);
      setPicked(r.items.map((it, i) => (it.tag === "할 일" ? i : -1)).filter((i) => i >= 0));
      setAdded(false);
      setShared(false);
      if (r.kind !== "minutes") toast.show(r.title);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "회의록을 정리하지 못했어요");
    }
    setBusy(false);
  }

  async function addTasks() {
    setBusy(true);
    try {
      for (const i of picked) {
        const it = items[i] as Item;
        await createTeamTask(data!.teamId, { title: it.text, assigneeId: it.assigneeId ?? null, due: it.due ?? null });
      }
      setAdded(true);
      toast.show("팀 할 일에 추가하고 담당자에게 알렸어요");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "할 일을 추가하지 못했어요");
    }
    setBusy(false);
  }

  async function share() {
    const lines = [
      `📝 ${data!.title} 회의록 (${when})`,
      ...(summary.length ? ["[요약]", ...summary.map((s) => `- ${s.text}`)] : []),
      ...(decided.length ? ["[정한 것]", ...decided.map((d) => `- ${d.tag === "정함" ? "✓" : "?"} ${d.text}`)] : []),
      ...(tasks.length ? ["[할 일]", ...tasks.map(({ it }) => `- ${it.text}${it.sub ? ` (${it.sub})` : ""}`)] : []),
    ];
    try {
      await sendTeamMessage(data!.teamId, lines.join("\n"));
      setShared(true);
      toast.show("대화방에 회의록을 올렸어요");
    } catch {
      toast.show("대화방에 올리지 못했어요");
    }
  }

  const count = picked.length;
  let label = "추가할 할 일을 골라주세요";
  if (count > 0) label = `고른 ${count}개 팀 할 일에 추가`;
  if (added) label = "할 일에 추가했어요";

  return (
    <main className="screen">
      <TopBar back={back} backLabel="회의 카드로" title="회의록" />

      <div className="screen__body" style={{ padding: "14px 16px", gap: 10 }}>
        <section className="card gap-4">
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{data.title}</h1>
          <span className="t-13 t-muted">{when}</span>
          {reply ? (
            <span className="t-12" style={{ color: "var(--accent-strong)", background: "var(--accent-soft)", borderRadius: 6, padding: "3px 8px", alignSelf: "flex-start", marginTop: 4 }}>
              싱클 AI가 회의 메모와 회의 시간 대화로 정리했어요 · 틀릴 수 있어요
            </span>
          ) : null}
        </section>

        {!reply ? (
          <section className="card gap-8">
            <h2 className="t-15 t-strong">회의 메모 (선택)</h2>
            <textarea
              className="input"
              rows={7}
              maxLength={6000}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={"회의 중에 적은 메모를 붙여 넣어 주세요\n예: 발표는 희원, 자료는 11/9까지"}
              aria-label="회의 메모"
              style={{ height: "auto", padding: 12, lineHeight: 1.5, resize: "none" }}
            />
            <span className="t-12 t-muted">회의 시간({when}) 동안의 대화방 메시지도 같이 읽어요</span>
          </section>
        ) : (
          <>
            <section className="card gap-8">
              <h2 className="t-15 t-strong">요약</h2>
              {summary.length ? (
                <ul className="stack gap-4 t-14" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                  {summary.map((s, i) => (
                    <li key={i}>{s.text}</li>
                  ))}
                </ul>
              ) : (
                <span className="t-13 t-muted">요약할 내용을 찾지 못했어요</span>
              )}
            </section>
            {decided.length ? (
              <section className="card gap-8">
                <h2 className="t-15 t-strong">정한 것</h2>
                {decided.map((d, i) => (
                  <div key={i} className="hstack gap-10 t-14" style={{ alignItems: "flex-start", lineHeight: 1.5 }}>
                    <span className="t-bold" style={{ color: d.tag === "정함" ? "var(--ok)" : "var(--warn)" }} aria-label={d.tag === "정함" ? "정함" : "아직 안 정함"}>
                      {d.tag === "정함" ? "✓" : "?"}
                    </span>
                    <span>{d.text}</span>
                  </div>
                ))}
              </section>
            ) : null}
            <section className="card gap-6">
              <div className="hstack">
                <h2 className="t-15 t-strong grow">회의에서 나온 할 일</h2>
                <span className="t-12 t-muted">{added ? "추가 완료" : `${count}개 선택`}</span>
              </div>
              {tasks.length ? (
                tasks.map(({ it, i }) => {
                  const on = picked.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={on}
                      disabled={added}
                      onClick={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                      className="hstack gap-10"
                      style={{ minHeight: 48, padding: "4px 0", border: 0, background: "none", textAlign: "left", cursor: added ? "default" : "pointer" }}
                    >
                      <CheckBox on={on} />
                      <span className="stack grow" style={{ gap: 1 }}>
                        <span className="t-14">{it.text}</span>
                        {it.sub ? <span className="t-12 t-muted">{it.sub}</span> : null}
                      </span>
                    </button>
                  );
                })
              ) : (
                <span className="t-13 t-muted">회의에서 나온 할 일을 찾지 못했어요</span>
              )}
            </section>
            <div className="hstack gap-8">
              <button type="button" className="btn btn--ghost grow t-13" style={{ height: 44 }} disabled={busy || shared} onClick={() => void share()}>
                {shared ? "대화방에 올렸어요" : "대화방에 올리기"}
              </button>
              <button type="button" className="btn btn--ghost grow t-13" style={{ height: 44 }} disabled={busy} onClick={() => setReply(null)}>
                메모 고쳐서 다시
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="footer">
        {reply ? (
          <button type="button" className="btn btn--primary" disabled={busy || added || count === 0} onClick={() => void addTasks()}>
            {busy ? "추가하는 중…" : label}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void run()}>
            {busy ? "AI가 정리하는 중…" : "AI로 회의록 정리"}
          </button>
        )}
      </footer>
      <Toast message={toast.message} bottom={96} />
    </main>
  );
}
