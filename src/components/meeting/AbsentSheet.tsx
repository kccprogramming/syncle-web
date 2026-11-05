"use client";

/** 8-2 참석이 어려워요 시트 (서연님 화면 예시): 이유와 원하는 방법을 골라 방장과 AI에게 알려요. */
import { useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/Sheet";
import { RadioCard } from "./RadioCard";

const REASONS = ["수업·과제", "알바", "아파요", "기타"];
const WAYS = [
  { id: "redo", title: "다시 조율해 주세요", note: "AI가 새 시간을 찾아 방장에게 제안해요" },
  { id: "skip", title: "저 빼고 진행해 주세요", note: "회의록과 내 할 일을 대화방으로 받아요" },
] as const;

export function AbsentSheet({
  onClose,
  dayLabel,
  viewerName,
  ownerName,
  chatHref,
}: {
  onClose: () => void;
  /** "11/11(수)" */
  dayLabel: string;
  viewerName: string;
  ownerName: string;
  chatHref: string;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [way, setWay] = useState<(typeof WAYS)[number]["id"]>("redo");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <Sheet open onClose={onClose} label="알림 보냄">
        <div className="stack gap-10 t-center" style={{ alignItems: "center", padding: "12px 0" }}>
          <span className="avatar" style={{ width: 52, height: 52, background: "var(--ok-bg)", color: "var(--ok)", fontSize: 24, fontWeight: 700 }}>
            ✓
          </span>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{ownerName}님과 AI에게 알렸어요</h2>
          <p className="t-14 t-ink2" style={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {way === "redo"
              ? `AI가 ${viewerName}님을 포함한 새 시간을 찾고 있어요.\n${ownerName}님이 정하면 다시 알려드릴게요.`
              : "회의는 그대로 진행돼요.\n끝나면 회의록과 할 일을 보내드릴게요."}
          </p>
        </div>
        <Link href={chatHref} className="btn btn--primary" style={{ height: 50 }}>
          대화방으로
        </Link>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title={`${dayLabel} 회의에 못 가나요?`} sub={`${viewerName}님 화면 · 방장 ${ownerName}님과 AI에게 알려요`}>
      <div className="field">
        <span className="field__label">
          이유 <span className="t-muted" style={{ fontWeight: 400 }}>· 팀원에게는 ‘일정이 생겼어요’로만 보여요</span>
        </span>
        <div className="hstack gap-8" style={{ flexWrap: "wrap" }} role="radiogroup" aria-label="이유">
          {REASONS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} className={`chip${reason === r ? " chip--on" : ""}`} onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">어떻게 할까요?</span>
        <div role="radiogroup" aria-label="어떻게 할까요" className="stack gap-8">
          {WAYS.map((w) => (
            <RadioCard key={w.id} on={way === w.id} onClick={() => setWay(w.id)} title={w.title} lines={[{ text: w.note }]} />
          ))}
        </div>
      </div>

      <button type="button" className="btn btn--primary" style={{ height: 50 }} onClick={() => setSent(true)}>
        알리기
      </button>
    </Sheet>
  );
}
