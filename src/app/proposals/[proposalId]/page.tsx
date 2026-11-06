"use client";

/**
 * 5 회의 제안 상세 (+ 5-2 내 응답 수정 시트)
 * /proposals/p-1            기본
 * /proposals/p-1?sheet=reply 응답 수정 시트를 연 채로 시작
 * /proposals/p-1?sheet=confirm 아직 응답 안 한 사람이 있을 때 '그래도 확정할까요?' 시트를 연 채로 시작
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { Toast, useToast } from "@/components/Toast";
import { Sheet } from "@/components/Sheet";
import { useDemo, useProposal } from "@/lib/demo-store";
import { confirmProposal, getMember, getPlaces, getTeam } from "@/lib/data";
import type { ConfirmRequest } from "@/types";
import { getChosenPlace } from "@/components/chat/team-info";
import { StatusPill } from "@/components/meeting/StatusPill";
import { ModeToggle } from "@/components/meeting/ModeToggle";
import { ReplySheet } from "@/components/meeting/ReplySheet";
import { countFor } from "@/components/meeting/proposal-utils";
import { LiveProposal } from "@/components/scheduling/LiveProposal";
import { usesLiveScreen } from "@/lib/scheduling-client";

export default function ProposalPage() {
  return (
    <Suspense fallback={null}>
      <ProposalEntry />
    </Suspense>
  );
}

/** 실제 제안(Supabase에 저장된 UUID)이면 C 화면(지우), 예시 제안(p-1 …)이면 지금 데모 화면 */
function ProposalEntry() {
  const { proposalId } = useParams<{ proposalId: string }>();
  return usesLiveScreen(proposalId) ? <LiveProposal proposalId={proposalId} /> : <ProposalInner />;
}

/** 펼치고 접는 줄 사이의 얇은 선 */
function Line() {
  return <div className="divider" style={{ margin: "0 16px" }} />;
}

/** 체크 표시 + 이유 한 줄 */
function Reason({ text }: { text: string }) {
  return (
    <div className="hstack gap-8 t-13" style={{ alignItems: "flex-start", lineHeight: 1.5 }}>
      <span style={{ marginTop: 3 }}>
        <Icon name="check" size={16} strokeWidth={2.4} color="var(--accent)" />
      </span>
      <span>{text}</span>
    </div>
  );
}

function ProposalInner() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { state, update } = useDemo();
  const toast = useToast();

  const proposal = useProposal(proposalId);
  const base = `/proposals/${proposal.id}`;
  const online = state.mode === "online";
  // 6에서 장소를 고르기 전에는 예시 장소 대신 '장소 고르기'를 보여줘요
  const picked = !!state.chosenPlace && state.chosenPlace.id === state.placeId;
  const place = picked ? getChosenPlace(proposal.id, state) : null;
  const owner = getMember(getTeam(proposal.teamId).ownerId); // 방장
  const pendingName = getMember(proposal.pendingIds[0]).name;

  // 펼치기/접기 상태
  const [showReasons, setShowReasons] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [replyOpen, setReplyOpen] = useState(sp.get("sheet") === "reply");
  const [askConfirm, setAskConfirm] = useState(sp.get("sheet") === "confirm");

  // 응답 인원 (지우가 응답했으면 모두 응답)
  const total = proposal.respondedIds.length + proposal.pendingIds.length;
  const responded = proposal.respondedIds.length + (state.jiwooResponded ? 1 : 0);
  const allResponded = responded >= total;

  const best = proposal.times.find((t) => t.recommended) ?? proposal.times[0];
  const others = proposal.times.filter((t) => t.id !== best.id);
  const bestCount = countFor(best, state);
  const [firstReason, ...moreReasons] = proposal.reasons;

  function saveReply(picks: string[]) {
    update({ myPicks: picks });
    setReplyOpen(false);
    toast.show("응답을 고쳤어요 · AI가 추천을 다시 계산해요");
  }

  // 방장이 확정: '추천대로 확정'이라 추천 시간 + 6에서 고른 장소를 C 확정 API에 넘겨요
  function confirm() {
    const req: ConfirmRequest = {
      proposalId: proposal.id,
      timeCandidateId: best.cTimeCandidateId ?? best.id,
      placeId: online ? null : picked ? state.placeId : null,
      acknowledgePartialAttendance: !allResponded,
    };
    confirmProposal(req);
    update({ confirmed: true, confirmRequest: req });
    router.push(`/teams/${proposal.teamId}`);
  }

  // 아직 응답하지 않은 사람이 있으면 한 번 더 물어봐요 (확정은 방장이 정해요)
  const pendingNames = allResponded ? [] : proposal.pendingIds.map((id) => getMember(id).name);
  function tryConfirm() {
    if (allResponded) confirm();
    else setAskConfirm(true);
  }

  return (
    <main className="screen">
      <TopBar
        back={`/teams/${proposal.teamId}`}
        backLabel="대화방으로"
        title="회의 제안"
        right={state.confirmed ? <StatusPill tone="ok">확정</StatusPill> : <StatusPill tone="gray">초안</StatusPill>}
      />

      <div className="screen__body" style={{ padding: "12px 16px", gap: 10 }}>
        {/* 목적 카드: 제목, 방식, 마감, 응답 수 */}
        <section className="card">
          <div className="stack gap-2">
            <h1 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35 }}>{proposal.title}</h1>
            <div className="hstack gap-8" style={{ marginTop: 4 }}>
              <ModeToggle mode={state.mode} onChange={(mode) => update({ mode })} />
              <span className="t-13 t-muted">
                {proposal.durationLabel} · {online ? "화면 공유 필요" : proposal.placeNote}
              </span>
            </div>
          </div>
          <div className="divider" />
          <div className="hstack gap-8">
            <Icon name="timer" size={16} strokeWidth={2} color="var(--warn)" />
            <span className="t-14 t-strong">응답 마감 {proposal.deadline}</span>
            <span className="tag tag--warn">{proposal.deadlineDday}</span>
            <span className="t-12 t-muted" style={{ marginLeft: "auto" }}>
              응답 {responded}/{total}명
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="응답한 사람"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={responded}
            style={{ height: 6, borderRadius: 3, background: "var(--line)" }}
          >
            <div style={{ width: `${(responded / total) * 100}%`, height: 6, borderRadius: 3, background: "var(--accent)" }} />
          </div>
          <div className="hstack gap-8">
            <span className="t-12 t-muted grow">
              {proposal.deadlineReason}
              {allResponded ? "" : ` · ${pendingName}님 응답 전`}
            </span>
            {allResponded ? null : (
              <button type="button" className="btn btn--sm btn--ghost no-shrink t-12" style={{ fontSize: 12 }} onClick={() => toast.show(`${pendingName}님에게 다시 알렸어요`)}>
                다시 알림
              </button>
            )}
          </div>
        </section>

        {/* AI 추천 시간 카드 */}
        <section className="card" style={{ gap: 8 }}>
          <div className="hstack gap-8">
            <span className="t-12 t-bold" style={{ color: "#fff", background: "var(--accent)", borderRadius: 8, padding: "2px 8px" }}>
              AI 추천 시간
            </span>
            <span className="t-12 t-strong t-ok" style={{ marginLeft: "auto" }}>
              응답 {bestCount.responded}명 중 {bestCount.available}명 가능
            </span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{best.label}</span>
          <span className="t-13 t-muted">{allResponded ? `${total}명 모두 응답했어요` : proposal.pendingNote}</span>

          {showReasons ? (
            // 펼친 모양: 연한 파란 상자 안에 이유 전부
            <div className="stack gap-8" style={{ background: "var(--accent-softer)", borderRadius: 10, padding: "10px 12px" }}>
              <span className="t-12 t-strong" style={{ color: "var(--accent-ink)" }}>
                이 시간을 추천한 이유
              </span>
              {proposal.reasons.map((r) => (
                <Reason key={r} text={r} />
              ))}
            </div>
          ) : (
            <Reason text={firstReason} />
          )}

          {showOthers ? (
            <div className="stack gap-8">
              <span className="t-12 t-strong t-muted">다른 후보 · 추천하지 않은 이유</span>
              {others.map((t) => (
                <div key={t.id} className="hstack gap-10" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                  <span className="radio" style={{ width: 18, height: 18 }} aria-hidden="true" />
                  <div className="stack grow" style={{ gap: 1 }}>
                    <span className="t-14 t-strong">{t.label}</span>
                    <span className="t-12 t-warn">{t.whyNotDetail ?? t.whyNot}</span>
                  </div>
                  <span className="t-12 t-muted no-shrink">{countFor(t, state).available}명 가능</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="btn-row">
            <button type="button" className="btn btn--soft" aria-expanded={showReasons} onClick={() => setShowReasons(!showReasons)}>
              {showReasons ? "이유 접기" : `이유 ${moreReasons.length}개 더 보기`}
            </button>
            <button type="button" className="btn btn--soft" aria-expanded={showOthers} onClick={() => setShowOthers(!showOthers)}>
              {showOthers ? "다른 후보 접기" : `다른 후보 ${others.length}개 보기`}
            </button>
          </div>
        </section>

        {/* 장소 줄: 대면이면 고른 장소, 온라인이면 안내 */}
        {online ? (
          <div className="card" style={{ padding: "12px 16px", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon name="video" size={20} strokeWidth={1.8} color="var(--accent)" />
            <div className="stack gap-2 grow">
              <span className="t-15 t-strong">온라인 회의</span>
              <span className="t-12 t-muted">확정되면 방장이 회의 링크를 대화방에 올려요 · 이동 0분</span>
            </div>
          </div>
        ) : (
          <Link href={`${base}/places`} className="card" style={{ padding: "12px 16px", flexDirection: "row", alignItems: "center", gap: 12, color: "var(--ink)" }}>
            <Icon name="pin" size={20} strokeWidth={1.8} color="var(--accent)" />
            <div className="stack gap-2 grow">
              <span className="t-15 t-strong">{place ? place.name : "팀원 사이 공평한 지역에서 찾아요"}</span>
              <span className="t-12 t-muted">
                {place
                  ? `${place.walk}${place.diffMinutes == null ? "" : ` · 사람 간 차이 ${place.diffMinutes}분`}`
                  : "출발지를 보고 모두 비슷하게 걸리는 곳을 추천해요"}
              </span>
            </div>
            <span className="t-13 t-strong t-accent no-shrink">{place ? "장소 바꾸기 ›" : "장소 고르기 ›"}</span>
          </Link>
        )}

        {/* 안건 · 참고한 발언 · 내 조건 */}
        <section className="card card--flush">
          <button type="button" className="row" aria-expanded={showAgenda} onClick={() => setShowAgenda(!showAgenda)}>
            <span className="t-14 t-strong no-shrink">안건 초안 {proposal.agenda.length}개</span>
            <span className="t-12 t-muted grow t-ellipsis">{showAgenda ? "" : `${proposal.agenda[0]} 외 ${proposal.agenda.length - 1}개`}</span>
            <span className="t-12 t-muted no-shrink">{showAgenda ? "접기" : "펼치기"}</span>
          </button>
          {showAgenda ? (
            <ol className="stack gap-4 t-13" style={{ margin: 0, padding: "0 16px 12px 36px", lineHeight: 1.5 }}>
              {proposal.agenda.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          ) : null}
          <Line />
          <button type="button" className="row" aria-expanded={showSources} onClick={() => setShowSources(!showSources)}>
            <span className="t-14 t-strong no-shrink">AI가 참고한 발언 {proposal.sources.length}개</span>
            <span className="t-12 t-muted grow t-ellipsis">{showSources ? "" : `${[...new Set(proposal.sources.map((x) => x.who))].slice(0, 3).join(", ")}${new Set(proposal.sources.map((x) => x.who)).size > 3 ? " 외" : ""}`}</span>
            <span className="t-12 t-muted no-shrink">{showSources ? "접기" : "펼치기"}</span>
          </button>
          {showSources ? (
            <div className="stack gap-8 t-12" style={{ padding: "0 16px 12px", lineHeight: 1.5 }}>
              {proposal.sources.map((s) => (
                <span key={s.quote}>
                  {s.who} “{s.quote}” <span className="t-accent">→ {s.effect}</span>
                </span>
              ))}
            </div>
          ) : null}
          <Line />
          <Link href={`${base}/conditions`} className="row" style={{ color: "var(--ink)" }}>
            <span className="t-14 t-strong grow">AI가 이해한 내 조건</span>
            <span className="t-13 t-accent">확인·수정 ›</span>
          </Link>
        </section>
      </div>

      <footer className="footer" style={{ padding: "8px 16px 16px", gap: 6 }}>
        <span className="footer__note">방장({owner.name})만 확정해요 · 마감이 지나면 응답한 사람 기준으로 정해요</span>
        <div className="btn-row">
          <button type="button" className="btn btn--outline" onClick={() => setReplyOpen(true)}>
            내 응답 수정
          </button>
          {state.confirmed ? (
            <Link href="/meetings/m-1" className="btn btn--primary">
              회의 카드 보기
            </Link>
          ) : (
            <button type="button" className="btn btn--primary" onClick={tryConfirm}>
              추천대로 확정
            </button>
          )}
        </div>
      </footer>

      {askConfirm && !allResponded ? (
        <Sheet
          open
          onClose={() => setAskConfirm(false)}
          title="아직 응답하지 않은 팀원이 있어요"
          sub={`${pendingNames.join(", ")}님이 응답 전이에요 · 응답 ${responded}/${total}명`}
        >
          <div className="stack gap-6 t-14 t-ink2" style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "12px 14px", lineHeight: 1.55 }}>
            <span>
              지금 확정하면 <strong className="t-strong" style={{ color: "var(--ink)" }}>응답한 {responded}명 기준</strong>으로 <span style={{ whiteSpace: "nowrap" }}>{best.label}</span>에 정해져요.
            </span>
            <span className="t-13 t-muted">{pendingNames.join(", ")}님에게는 확정 알림이 가고, 못 오면 ‘참석이 어려워요’로 알릴 수 있어요.</span>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              style={{ height: 50 }}
              onClick={() => {
                setAskConfirm(false);
                toast.show(`${pendingNames.join(", ")}님에게 다시 알렸어요`);
              }}
            >
              다시 알리고 기다리기
            </button>
            <button type="button" className="btn btn--primary" style={{ height: 50 }} onClick={confirm}>
              그래도 확정
            </button>
          </div>
        </Sheet>
      ) : null}

      {/* 열 때마다 새로 그려서 임시 선택이 초기화돼요 */}
      {replyOpen ? (
        <ReplySheet open onClose={() => setReplyOpen(false)} proposal={proposal} initialPicks={state.myPicks} onSave={saveReply} />
      ) : null}
      <Toast message={toast.message} bottom={112} />
    </main>
  );
}
