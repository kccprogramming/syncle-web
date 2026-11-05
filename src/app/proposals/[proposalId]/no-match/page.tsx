"use client";

/** 5-3 공통 시간 없음 — AI가 찾은 대안 중 하나를 골라 다시 제안해요. */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { useDemo } from "@/lib/demo-store";
import { getMember, getNoMatchOptions, getProposal, getTeam } from "@/lib/data";
import { StatusPill } from "@/components/meeting/StatusPill";
import { RadioCard } from "@/components/meeting/RadioCard";

export default function NoMatchPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const router = useRouter();
  const { update } = useDemo();

  const proposal = getProposal(proposalId);
  const options = getNoMatchOptions(proposal.id);
  const total = proposal.respondedIds.length + proposal.pendingIds.length;
  const owner = getMember(getTeam(proposal.teamId).ownerId); // 방장

  // 처음에는 AI 추천 대안을 골라 둬요
  const [selId, setSelId] = useState(options.find((o) => o.recommended)?.id ?? options[0].id);
  const selected = options.find((o) => o.id === selId) ?? options[0];

  function submit() {
    if (selected.id === "online") update({ mode: "online" });
    router.push(`/proposals/${proposal.id}`);
  }

  return (
    <main className="screen">
      <TopBar back={`/teams/${proposal.teamId}`} backLabel="대화방으로" title="회의 제안" right={<StatusPill tone="warn">조율 필요</StatusPill>} />

      <div className="screen__body" style={{ padding: "12px 16px", gap: 10 }}>
        <section className="card">
          <div className="stack gap-2">
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{proposal.title}</h1>
            <span className="t-13 t-muted">
              응답 {total}/{total}명 완료 · 마감 {proposal.deadline}
            </span>
          </div>
          <div className="hstack gap-10" style={{ alignItems: "flex-start", background: "var(--warn-bg)", borderRadius: 10, padding: 12 }}>
            <span style={{ marginTop: 1 }}>
              <Icon name="alert" color="var(--warn)" strokeWidth={2} />
            </span>
            <div className="stack gap-2">
              <span className="t-14 t-strong" style={{ color: "var(--warn-strong)" }}>
                자료 마감 전에 {total}명 모두 되는 시간이 없어요
              </span>
              <span className="t-12 t-warn" style={{ lineHeight: 1.5 }}>
                다음 주 평일 저녁·주말 오후를 모두 맞춰봤어요
              </span>
            </div>
          </div>
          <span className="t-13 t-ink2">AI가 고를 수 있는 방법 {options.length}가지를 찾았어요</span>
        </section>

        <div role="radiogroup" aria-label="대안 고르기" className="stack" style={{ gap: 10 }}>
          {options.map((o) => (
            <RadioCard
              key={o.id}
              big
              on={o.id === selId}
              onClick={() => setSelId(o.id)}
              title={o.title}
              badge={o.recommended ? "AI 추천" : undefined}
              lines={[{ text: o.when, className: "t-13 t-ink2" }, { text: o.note }]}
            />
          ))}
        </div>
      </div>

      <footer className="footer" style={{ padding: "8px 16px 16px", gap: 6 }}>
        <span className="footer__note">고르면 팀원들에게 다시 물어봐요 · 방장({owner.name})만 고를 수 있어요</span>
        <button type="button" className="btn btn--primary" onClick={submit}>
          {selected.cta}
        </button>
      </footer>
    </main>
  );
}
