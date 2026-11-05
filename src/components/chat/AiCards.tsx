"use client";

/** 대화방 안에 싱클 AI가 올리는 카드들: 회의 제안, 정리 중, 정리 실패, 회의 확정, 부탁 답(요약·할 일·자료·회의록) */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, Spinner } from "@/components/Icon";
import { getMeeting, getMember, getProposal } from "@/lib/data";
import { useDemo } from "@/lib/demo-store";
import type { AiReply } from "@/types";
import { getChosenPlace, respondedText } from "./team-info";

const cardBase: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: "4px 16px 16px 16px",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

/** 카드 안 한 줄: 아이콘 · 글 · 오른쪽 작은 글 */
function InfoRow({ icon, iconColor, children, right }: { icon: "clock" | "timer" | "pin"; iconColor?: string; children: React.ReactNode; right: string }) {
  return (
    <div className="hstack gap-8">
      <Icon name={icon} size={16} strokeWidth={icon === "timer" ? 2 : 1.8} color={iconColor ?? "var(--muted)"} />
      <span>{children}</span>
      <span className="t-12 t-muted" style={{ marginLeft: "auto" }}>
        {right}
      </span>
    </div>
  );
}

/** 3 AI 회의 제안 카드 */
export function ProposalCard({ proposalId, teamId }: { proposalId: string; teamId: string }) {
  const { state } = useDemo();
  const p = getProposal(proposalId);
  const s = p.cardSummary;
  const pendingName = p.pendingIds.length ? getMember(p.pendingIds[0]).name : null; // 아직 응답하지 않은 사람

  return (
    <section aria-label="AI 회의 제안" style={{ ...cardBase, border: "1.5px solid var(--accent)" }}>
      <div className="hstack gap-8">
        <span className="t-15 t-strong grow">{p.title}</span>
        <span className="tag tag--gray" style={{ fontSize: 12, borderRadius: 10, padding: "2px 8px" }}>
          초안
        </span>
      </div>
      <div className="stack gap-6 t-13">
        <InfoRow icon="clock" right={`후보 ${s.candidateCount}개`}>
          <strong>AI 추천</strong> {s.timeLabel}
        </InfoRow>
        <InfoRow icon="timer" iconColor="var(--warn)" right={respondedText(p, state)}>
          응답 마감 {p.deadline}
        </InfoRow>
        {/* 6에서 실제로 고른 장소가 있으면 그 장소, 없으면 아직 찾는 중이라는 안내 */}
        {state.chosenPlace && state.chosenPlace.id === state.placeId ? (
          <InfoRow icon="pin" right={state.chosenPlace.diffMinutes == null ? "" : `차이 ${state.chosenPlace.diffMinutes}분`}>
            {state.chosenPlace.short}
          </InfoRow>
        ) : (
          <InfoRow icon="pin" right="장소 후보 보기">
            팀원 사이 공평한 지역에서 찾아요
          </InfoRow>
        )}
      </div>
      {pendingName && !state.jiwooResponded ? (
        <Link
          href={`/teams/${teamId}/ask`}
          className="hstack gap-6 t-12"
          style={{ padding: "8px 10px", background: "var(--warn-bg)", color: "var(--warn)", borderRadius: 8, lineHeight: 1.5 }}
        >
          <span className="grow">{pendingName}님의 가능 시간은 아직 몰라서 따로 물어봤어요</span>
          <span className="t-strong no-shrink">{pendingName}님 화면 ›</span>
        </Link>
      ) : null}
      <Link href={`/proposals/${p.id}`} className="btn btn--primary" style={{ height: 44, borderRadius: 10, fontSize: 14 }}>
        추천 보고 응답하기
      </Link>
    </section>
  );
}

/** 단계 표시 동그라미: 끝남(✓) / 진행 중(돌아감) / 실패(!) / 아직 */
function StepMark({ kind }: { kind: "done" | "doing" | "fail" | "todo" }) {
  if (kind === "doing") return <Spinner size={20} />;
  const look = {
    done: { bg: "var(--ok-bg)", color: "var(--ok)", text: "✓", border: "0" },
    fail: { bg: "var(--warn-bg)", color: "var(--warn)", text: "!", border: "0" },
    todo: { bg: "var(--surface)", color: "transparent", text: "", border: "1.5px solid var(--line-strong)" },
  }[kind];
  return (
    <span
      aria-hidden="true"
      style={{ width: 20, height: 20, borderRadius: 10, background: look.bg, color: look.color, border: look.border, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      {look.text}
    </span>
  );
}

/** 3-1-1 AI가 회의를 정리하는 중 (시간이 지나면 단계가 하나씩 끝나요) */
export function AiWorkingCard({ proposalId }: { proposalId: string }) {
  const p = getProposal(proposalId);
  const [step, setStep] = useState(1); // 1: 시간 맞추는 중, 2: 장소 찾는 중

  useEffect(() => {
    const t = setTimeout(() => setStep(2), 1100);
    return () => clearTimeout(t);
  }, []);

  const steps = [
    { label: "최근 대화 읽기", doing: "최근 대화 읽기", right: `메시지 ${p.progress.messageCount}개` },
    { label: "팀원 가능 시간 맞추기", doing: "팀원 가능 시간 맞추는 중", right: `${p.respondedIds.length}/${p.respondedIds.length + p.pendingIds.length}명` },
    { label: "장소 찾기", doing: "팀원 사이 공평한 지역 찾는 중", right: "" },
  ];

  return (
    <section aria-label="AI가 회의를 정리하는 중" style={{ ...cardBase, border: "1.5px solid var(--accent-line)", gap: 12 }}>
      <span className="t-15 t-strong">회의 정리하는 중이에요</span>
      <div role="status" className="stack gap-10 t-13">
        {steps.map((s, i) => {
          const kind = i < step ? "done" : i === step ? "doing" : "todo";
          return (
            <div key={s.label} className="hstack gap-10">
              <StepMark kind={kind} />
              {kind === "doing" ? (
                <span className="grow t-strong" style={{ color: "var(--accent-strong)" }}>
                  {s.doing}
                </span>
              ) : (
                <span className={`grow${kind === "todo" ? " t-muted" : ""}`}>{s.label}</span>
              )}
              {kind === "done" && s.right ? <span className="t-12 t-muted">{s.right}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="pulse stack gap-6" aria-hidden="true">
        <div style={{ height: 10, width: "80%", borderRadius: 5, background: "var(--accent-soft)" }} />
        <div style={{ height: 10, width: "55%", borderRadius: 5, background: "var(--accent-soft)" }} />
      </div>
      <span className="t-12 t-muted">보통 10초 안에 끝나요 · 그동안 대화는 계속할 수 있어요</span>
    </section>
  );
}

/** 3-1-2 장소 찾기에 실패했을 때 */
export function AiFailedCard({ proposalId, onRetry, onTimeOnly }: { proposalId: string; onRetry: () => void; onTimeOnly: () => void }) {
  const p = getProposal(proposalId);
  return (
    <section aria-label="AI 정리 실패" style={{ ...cardBase, border: "1.5px solid var(--warn-line)" }}>
      <div className="hstack gap-8">
        <Icon name="alert" size={20} strokeWidth={2} color="var(--warn)" />
        <span className="t-15 t-strong">장소 정보를 불러오지 못했어요</span>
      </div>
      <p className="t-13 t-ink2" style={{ lineHeight: 1.55 }}>
        지도 서비스가 잠시 응답하지 않아요. 시간 추천은 끝났으니 먼저 받아볼 수 있어요.
      </p>
      <div className="stack gap-6 t-13">
        <div className="hstack gap-10">
          <StepMark kind="done" />
          <span>시간 추천 · {p.cardSummary.timeLabel}</span>
        </div>
        <div className="hstack gap-10">
          <StepMark kind="fail" />
          <span>장소 찾기 실패</span>
        </div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn--ghost" style={{ height: 44, borderRadius: 10, fontSize: 14, padding: "0 8px", whiteSpace: "nowrap" }} onClick={onRetry}>
          다시 시도
        </button>
        <button type="button" className="btn btn--primary" style={{ height: 44, borderRadius: 10, fontSize: 14, padding: "0 8px", whiteSpace: "nowrap" }} onClick={onTimeOnly}>
          시간만 먼저 받기
        </button>
      </div>
      <span className="t-12 t-muted">장소는 나중에 회의 제안에서 다시 찾을 수 있어요</span>
    </section>
  );
}

/** 3-4 회의가 확정됐다는 카드 */
export function ConfirmedCard({ meetingId }: { meetingId: string }) {
  const { state } = useDemo();
  const m = getMeeting(meetingId);
  const place = m.proposalId ? getChosenPlace(m.proposalId, state) : null;
  const placeText = place ? `${place.short} · ${place.walk}` : [m.placeName, m.placeMeta].filter(Boolean).join(" · ");

  return (
    <section aria-label="확정된 회의" style={{ ...cardBase, padding: 0, gap: 0, overflow: "hidden" }}>
      <div className="hstack gap-8" style={{ background: "var(--ok)", color: "#fff", padding: "12px 14px" }}>
        <Icon name="check" size={18} strokeWidth={2.4} />
        <span className="t-14 t-strong">회의가 확정됐어요</span>
      </div>
      <div className="stack gap-8" style={{ padding: "12px 14px" }}>
        <span className="t-15 t-strong">{m.title}</span>
        <div className="stack gap-4 t-13 t-ink2">
          <span>{m.dateLabel}</span>
          <span>{placeText}</span>
          <span>
            {m.attendeeIds.length}명 모두 참석 · 안건 {m.agenda.length}개
          </span>
        </div>
        <div className="btn-row" style={{ marginTop: 2 }}>
          <Link href={`/meetings/${m.id}`} className="btn btn--ghost" style={{ height: 40, borderRadius: 10, fontSize: 13, color: "var(--ink)" }}>
            회의 카드 보기
          </Link>
          <a
            href={place?.url ?? `https://map.kakao.com/link/search/${encodeURIComponent(m.placeName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--primary"
            style={{ height: 40, borderRadius: 10, fontSize: 13, gap: 4 }}
          >
            장소 사이트
            <Icon name="external" size={14} strokeWidth={2.2} />
          </a>
        </div>
        <span className="t-muted" style={{ fontSize: 11 }}>
          전날 저녁과 출발 1시간 전에 알려드릴게요
        </span>
      </div>
    </section>
  );
}

/** 요약·할 일 같은 부탁을 정리하는 짧은 동안 (1초 남짓) */
export function AiThinkingCard() {
  return (
    <section aria-label="AI가 답을 정리하는 중" role="status" style={{ ...cardBase, flexDirection: "row", alignItems: "center", gap: 10, padding: "12px 14px" }}>
      <Spinner size={18} />
      <span className="t-13 t-ink2">대화를 읽고 정리하고 있어요</span>
    </section>
  );
}

/** '@AI 요약해줘', '할 일 정리해줘' 같은 부탁에 대한 답 카드 */
export function AiReplyCard({ reply }: { reply: AiReply }) {
  return (
    <section aria-label={reply.title} style={{ ...cardBase, gap: 10 }}>
      <span className="t-15 t-strong">{reply.title}</span>
      <ul className="stack gap-8" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {reply.items.map((it, i) => (
          <li key={i} className="hstack gap-8" style={{ alignItems: "flex-start" }}>
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 3, background: "var(--accent)", marginTop: 8, flexShrink: 0 }} />
            <span className="stack gap-2 grow" style={{ minWidth: 0 }}>
              <span className="t-13" style={{ lineHeight: 1.5, wordBreak: "break-word" }}>
                {it.text}
                {it.tag ? (
                  <span className="tag tag--soft" style={{ marginLeft: 6, fontSize: 11, padding: "1px 6px", verticalAlign: "1px" }}>
                    {it.tag}
                  </span>
                ) : null}
              </span>
              {it.sub ? <span className="t-12 t-muted">{it.sub}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <span className="t-12 t-muted" style={{ borderTop: "1px solid var(--line-2)", paddingTop: 8 }}>
        {reply.basis}
      </span>
      {reply.link ? (
        <Link href={reply.link.href} className="t-13 t-strong" style={{ alignSelf: "flex-start", padding: "4px 0" }}>
          {reply.link.label} ›
        </Link>
      ) : null}
    </section>
  );
}
