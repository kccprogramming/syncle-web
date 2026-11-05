"use client";

/** 5-2 내 응답 수정 시트: 되는 시간 후보를 모두 고르고 저장해요. */
import { useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/Sheet";
import { CheckBox } from "@/components/Controls";
import type { Proposal } from "@/types";

export function ReplySheet({
  open,
  onClose,
  proposal,
  initialPicks,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  proposal: Proposal;
  initialPicks: string[];
  onSave: (picks: string[]) => void;
}) {
  // 시트 안에서만 쓰는 임시 선택. 아직 안 건드렸으면(null) 저장된 내 응답을 그대로 보여줘요.
  const [draft, setDraft] = useState<string[] | null>(null);
  const picks = draft ?? initialPicks;
  const can = picks.length > 0;

  function toggle(id: string) {
    setDraft(picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id]);
  }

  return (
    <Sheet open={open} onClose={onClose} title="내 응답 수정" sub={`되는 시간을 모두 골라주세요 · 마감 ${proposal.deadline}`}>
      <div className="stack gap-6" style={{ marginTop: -2 }}>
        {proposal.times.map((t) => {
          const on = picks.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.id)}
              className={`option${on ? " option--on" : ""}`}
              style={{ minHeight: 52, borderRadius: 12 }}
            >
              <CheckBox on={on} />
              <span className="t-15 t-strong grow">{t.label}</span>
              {t.recommended ? <span className="t-12 t-strong t-accent">AI 추천</span> : null}
            </button>
          );
        })}
      </div>
      <span className="t-12 t-muted">
        이번 회의만 다른 조건이 있으면 <Link href={`/proposals/${proposal.id}/conditions?sheet=add`}>조건 직접 추가 ›</Link>
      </span>
      <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={!can} onClick={() => onSave(picks)}>
        {can ? `응답 저장 (${picks.length}개 가능)` : "되는 시간을 골라주세요"}
      </button>
    </Sheet>
  );
}
