"use client";

/** 3-3 아직 응답 안 한 팀원(지우)에게만 보이는 '가능한 시간 묻기' 카드 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CheckBox } from "@/components/Controls";
import { getMember } from "@/lib/data";
import { useDemo, useProposal } from "@/lib/demo-store";

export function AskQuestionCard({ proposalId, viewerId, onToast }: { proposalId: string; viewerId: string; onToast: (text: string) => void }) {
  const { state, update } = useDemo();
  const p = useProposal(proposalId);
  const viewer = getMember(viewerId);

  // 고른 시간과 보냈는지 여부. 저장된 상태가 늦게 불러와져도 맞춰지도록 effect로 따라가요.
  const [picks, setPicks] = useState<string[]>(state.jiwooPicks);
  const [sent, setSent] = useState(state.jiwooResponded);
  useEffect(() => setPicks(state.jiwooPicks), [state.jiwooPicks]);
  useEffect(() => setSent(state.jiwooResponded), [state.jiwooResponded]);

  const toggle = (id: string) => setPicks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  // "11/11(수) 19:00–21:00" → "11/11(수)"
  const chosen = p.times.filter((t) => picks.includes(t.id)).map((t) => t.label.split(" ")[0]);
  const canSend = chosen.length > 0;

  const send = () => {
    if (!canSend) return;
    update({ jiwooResponded: true, jiwooPicks: picks });
    setSent(true);
  };

  return (
    <section aria-label="가능한 시간 묻기" className="stack gap-10" style={{ background: "var(--surface)", border: "1.5px solid var(--accent)", borderRadius: "4px 16px 16px 16px", padding: 14 }}>
      <div className="stack" style={{ gap: 3 }}>
        <span className="t-15 t-strong" style={{ lineHeight: 1.45 }}>
          {viewer.name}님, 다음 주 회의 시간을 정하고 있어요
        </span>
        <span className="t-12 t-muted">되는 시간을 모두 골라주세요 · 마감 {p.deadline}</span>
      </div>

      {!sent ? (
        <>
          <div className="stack gap-6">
            {p.times.map((t) => {
              const on = picks.includes(t.id);
              return (
                <button key={t.id} type="button" aria-pressed={on} className={`option${on ? " option--on" : ""}`} onClick={() => toggle(t.id)}>
                  <CheckBox on={on} />
                  <span className="t-14 t-strong grow">{t.label}</span>
                  {t.recommended ? (
                    <span className="t-accent t-strong" style={{ fontSize: 11 }}>
                      AI 추천
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="btn-row" style={{ gap: 6 }}>
            <button type="button" className="btn btn--ghost t-12" style={{ height: 36, borderRadius: 10, borderColor: "var(--line)", color: "var(--ink-2)" }} onClick={() => onToast("준비 중이에요")}>
              다 안 돼요
            </button>
            <button type="button" className="btn btn--ghost t-12" style={{ height: 36, borderRadius: 10, borderColor: "var(--line)", color: "var(--ink-2)" }} onClick={() => onToast("준비 중이에요")}>
              다른 시간 입력
            </button>
          </div>
          <button type="button" className="btn btn--primary" style={{ height: 44, borderRadius: 10, fontSize: 14 }} disabled={!canSend} onClick={send}>
            {canSend ? `응답 보내기 (${chosen.length}개 선택)` : "되는 시간을 골라주세요"}
          </button>
          <span className="t-muted t-center" style={{ fontSize: 11 }}>
            팀원들에게는 고른 시간만 보여요
          </span>
        </>
      ) : (
        <>
          <div className="hstack gap-8" style={{ background: "var(--ok-bg)", borderRadius: 10, padding: "10px 12px", alignItems: "flex-start" }}>
            <Icon name="check" size={18} strokeWidth={2.4} color="var(--ok)" />
            <span className="t-13" style={{ lineHeight: 1.5, color: "var(--ok-ink)" }}>
              응답했어요 · {chosen.join(", ")} 가능
              <br />
              이제 {p.respondedIds.length + p.pendingIds.length}명 모두 응답해서 AI가 추천을 다시 계산했어요
            </span>
          </div>
          <Link href={`/proposals/${p.id}`} className="btn btn--outline" style={{ height: 44, borderRadius: 10, fontSize: 14 }}>
            회의 제안 자세히 보기
          </Link>
          <button type="button" className="t-12 t-muted" style={{ height: 36, border: 0, background: "none" }} onClick={() => setSent(false)}>
            응답 수정하기
          </button>
        </>
      )}
    </section>
  );
}
