"use client";

/**
 * 7 AI가 이해한 내 조건 (+ 7-1 조건 직접 추가 시트)
 * /proposals/p-1/conditions           기본
 * /proposals/p-1/conditions?sheet=add 추가 시트를 연 채로 시작
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { CheckBox } from "@/components/Controls";
import { Toast, useToast } from "@/components/Toast";
import { useDemo, useProposal } from "@/lib/demo-store";
import { getConditions, getMe } from "@/lib/data";
import type { Condition } from "@/types";
import { AddConditionSheet, type ConditionKind } from "@/components/meeting/AddConditionSheet";

// 선호 칩 (AI가 대화에서 이해한 것)
// TODO: API 연결 시 data.ts로 옮기기
const PREFERENCES = ["평일 저녁 선호", "이동 1시간 이내"];

export default function ConditionsPage() {
  return (
    <Suspense fallback={null}>
      <ConditionsInner />
    </Suspense>
  );
}

/** 연필 버튼이 붙은 조건 한 줄 */
function ConditionRow({ title, source, ai, editLabel, onEdit }: { title: string; source: string; ai?: boolean; editLabel: string; onEdit: () => void }) {
  return (
    <div
      className="hstack gap-10"
      style={{
        border: ai ? "1.5px solid var(--accent-line)" : "1px solid var(--line)",
        background: ai ? "var(--accent-softer)" : "var(--surface)",
        borderRadius: 12,
        padding: "9px 8px 9px 12px",
      }}
    >
      <div className="stack gap-2 grow">
        <span className="t-14 t-strong">{title}</span>
        <span className="t-12 t-muted t-ellipsis">{source}</span>
      </div>
      <button
        type="button"
        aria-label={editLabel}
        onClick={onEdit}
        className="icon-btn"
        style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg)", color: "var(--muted)" }}
      >
        <Icon name="edit" size={18} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function ConditionsInner() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const sp = useSearchParams();
  const { state, update } = useDemo();
  const toast = useToast();
  const me = getMe();

  const proposal = useProposal(proposalId);
  const conditions = [...getConditions(proposal.id), ...state.addedConditions];

  // 시트: null이면 닫힘, 아니면 처음 고를 종류
  const [sheetKind, setSheetKind] = useState<ConditionKind | null>(sp.get("sheet") === "add" ? "no" : null);
  const [otherOrigin, setOtherOrigin] = useState(false);

  function addCondition(c: Condition) {
    // 화면 한 장에 들어가도록, 직접 추가한 조건은 마지막 1개만 남겨요 (원본 디자인과 같아요)
    update({ addedConditions: [c] });
    setSheetKind(null);
    toast.show("조건을 추가했어요 · AI가 추천을 다시 계산해요");
  }

  const soon = () => toast.show("준비 중이에요");

  return (
    <main className="screen">
      <TopBar back={`/proposals/${proposal.id}`} backLabel="회의 제안으로" title="내 조건" />

      <div className="screen__body" style={{ padding: "14px 16px", gap: 10 }}>
        <p className="t-13 t-ink2" style={{ lineHeight: 1.5 }}>
          AI가 대화와 프로필에서 이해한 조건이에요. 틀리면 고쳐 주세요.
        </p>

        <section className="card" style={{ padding: 14, gap: 8 }}>
          <h2 className="t-15 t-strong">시간 조건</h2>
          {conditions.map((c) => (
            <ConditionRow key={c.id} title={c.title} source={c.source} ai={c.fromAi} editLabel={`${c.title} 수정`} onEdit={soon} />
          ))}
          <button type="button" className="btn chip--dashed t-14" style={{ height: 44, borderRadius: 10, background: "var(--surface)", color: "var(--ink-2)", fontWeight: 400 }} onClick={() => setSheetKind("no")}>
            + 조건 직접 추가
          </button>
        </section>

        <section className="card" style={{ padding: 14, gap: 8 }}>
          <h2 className="t-15 t-strong">출발 위치</h2>
          <ConditionRow
            title={state.origin?.name ?? me.origin}
            source={`팀원에게는 ‘${state.origin?.area ?? me.originArea}’까지만 보여요`}
            editLabel="출발 위치 수정"
            onEdit={soon}
          />
          <button
            type="button"
            aria-pressed={otherOrigin}
            onClick={() => setOtherOrigin(!otherOrigin)}
            className="hstack gap-10 t-14"
            style={{ minHeight: 40, padding: 0, border: 0, background: "none", textAlign: "left" }}
          >
            <CheckBox on={otherOrigin} />
            이번 회의만 다른 곳에서 출발
          </button>
        </section>

        <section className="card" style={{ padding: 14, gap: 8 }}>
          <h2 className="t-15 t-strong">선호</h2>
          <div className="hstack gap-8" style={{ flexWrap: "wrap" }}>
            {PREFERENCES.map((p) => (
              <span key={p} className="t-13" style={{ padding: "6px 12px", borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent-strong)" }}>
                {p}
              </span>
            ))}
            <button
              type="button"
              className="t-13"
              style={{ padding: "6px 12px", borderRadius: 16, border: 0, background: "var(--line-2)", color: "var(--ink-2)" }}
              onClick={() => setSheetKind("prefer")}
            >
              + 추가
            </button>
          </div>
        </section>
      </div>

      <footer className="footer">
        <Link href={`/proposals/${proposal.id}`} className="btn btn--primary">
          확인하고 제안에 반영
        </Link>
      </footer>

      {sheetKind ? <AddConditionSheet initialKind={sheetKind} onClose={() => setSheetKind(null)} onAdd={addCondition} /> : null}
      <Toast message={toast.message} bottom={96} />
    </main>
  );
}
