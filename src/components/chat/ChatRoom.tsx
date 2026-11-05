"use client";

/**
 * 3 대화방 화면 전체.
 * page.tsx는 주소(팀 id, 쿼리)와 확정 여부만 읽어서 넘기고, 화면 동작은 여기에 모았어요.
 * confirmed를 true로 넘기면 3-4(확정 뒤 대화)가 그려져요.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { AiAvatar } from "@/components/Logo";
import { Toast, useToast } from "@/components/Toast";
import { getAiReply, getFiles, getMe, getMessages, getTeam, requestAi } from "@/lib/data";
import type { Message, Team } from "@/types";
import { isSchedulingRequest } from "@/lib/place-intent";
import { useDemo } from "@/lib/demo-store";
import { AI_CHIPS, AiHelpPanel } from "./AiHelpPanel";
import { ChatMessages, type ChatItem } from "./ChatMessages";
import { Composer } from "./Composer";
import { ShareSheet } from "./ShareSheet";
import { SummaryBar } from "./SummaryBar";
import { TeamDrawer } from "./TeamDrawer";
import { DEMO_TEAM_ID, getTeamMeetings, getTeamProposal, meetingLine, shortTitle, taskSummary, useTeamAi } from "./team-info";

/** AI가 회의를 정리하는 데 걸리는 시간(흉내) */
const WORKING_MS = 2500;
/** 요약·할 일 같은 부탁에 답하는 데 걸리는 시간(흉내) */
const THINKING_MS = 900;

let idSeq = 0;
const newId = () => `local-${Date.now()}-${idSeq++}`;
const nowLabel = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function ChatRoom({
  teamId,
  liveTeam,
  confirmed,
  fresh = false,
  fail = false,
  startShare = false,
  startMenu = false,
}: {
  teamId: string;
  /** 진짜 팀(A · Supabase). 있으면 데모 대화 · 요약 대신 이 팀 정보를 보여줘요 (대화 메시지 연결은 다음 단계) */
  liveTeam?: Team;
  /** 회의가 확정됐는지 (데모 팀에서만 의미가 있어요) */
  confirmed: boolean;
  /** true면 AI에게 부탁하기 전 대화(글·파일만)로 시작 */
  fresh?: boolean;
  /** true면 AI 정리가 한 번 실패해요 (3-1-2 시연용) */
  fail?: boolean;
  startShare?: boolean;
  startMenu?: boolean;
}) {
  const { state, update } = useDemo();
  const me = getMe();
  const team = liveTeam ?? getTeam(teamId);
  const isConfirmed = confirmed && teamId === DEMO_TEAM_ID;
  const proposalId = getTeamProposal(teamId, state.cProposal)?.id ?? "p-1";
  const { aiOn, setAiOn } = useTeamAi(team);
  const toast = useToast();

  const [extra, setExtra] = useState<ChatItem[]>([]); // 이 화면에서 새로 보낸 메시지들
  const [draft, setDraft] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(startShare);
  const [menuOpen, setMenuOpen] = useState(startMenu);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 화면을 떠나면 기다리던 타이머 정리
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // 서버 메시지 + 이 화면에서 보낸 메시지
  // 진짜 팀은 아직 데모 대화를 보여주지 않아요 (A 메시지 연결 전)
  let base: ChatItem[] = liveTeam ? [] : getMessages(teamId, isConfirmed);
  if (fresh && !isConfirmed) base = base.filter((m) => m.type === "text" || m.type === "file");
  const items = [...base, ...extra];

  // 새 메시지가 생기면 맨 아래로
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [extra, helpOpen]);

  /** 목록에서 id가 같은 카드를 다른 카드로 바꾸기 */
  const replaceItem = useCallback((id: string, next: ChatItem) => {
    setExtra((prev) => prev.map((m) => (m.id === id ? next : m)));
  }, []);

  /** '정리 중' 카드를 잠시 보여 준 뒤 제안 카드(또는 실패 카드)로 바꿔요 */
  const runAi = useCallback(
    (workingId: string, mayFail: boolean) => {
      const t = setTimeout(() => {
        const at = nowLabel();
        replaceItem(workingId, mayFail ? { id: newId(), type: "ai-failed", proposalId, at } : { id: newId(), type: "ai-proposal", proposalId, at });
      }, WORKING_MS);
      timers.current.push(t);
    },
    [proposalId, replaceItem],
  );

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const at = nowLabel();
    const callsAi = text.includes("@AI");
    const mine: ChatItem = callsAi
      ? { id: newId(), type: "mention-ai", senderId: me.id, text: text.replace("@AI", "").trim(), at }
      : { id: newId(), type: "text", senderId: me.id, text, at };

    setDraft("");
    setHelpOpen(false);
    inputRef.current?.blur();

    if (callsAi && !aiOn) {
      setExtra((prev) => [...prev, mine]);
      toast.show("AI 도우미가 꺼져 있어요");
    } else if (callsAi && isSchedulingRequest(text)) {
      const workingId = newId();
      setExtra((prev) => [...prev, mine, { id: workingId, type: "ai-working", proposalId, at }]);
      // B(회의 조건 추출)에게 먼저 물어봐요. 키가 없으면(mock) 지금까지의 예시 흐름 그대로예요.
      const sent = [...extra, mine].filter((m): m is Message => m.type === "text" || m.type === "mention-ai");
      requestAi(teamId, text, sent)
        .then((r) => {
          // AI가 대화를 보고 고른 장소 종류를 기억해요 (6 장소 후보가 이걸로 찾아요). 사람이 바꿨던 값은 지워요.
          if (r.placeIntent) update({ aiPlaceIntent: r.placeIntent, placeKeyword: null });
          // C가 시간 후보를 계산한 제안이 있으면 그걸로 카드·5·6·7을 보여줘요. 새 제안이니 내 응답도 다시 골라 둬요
          if (r.proposal) update({ cProposal: r.proposal, myPicks: r.proposal.times.map((t) => t.id), jiwooResponded: false });
          if (r.source === "mock" || !r.reply) return runAi(workingId, fail);
          const reply: ChatItem = { id: newId(), type: "ai-reply", reply: r.reply, at: nowLabel() };
          // 조건이 정리됐으면 이어서 시간 제안(C · 아직 예시 데이터)을 보여줘요
          setExtra((prev) => prev.flatMap((m) => (m.id === workingId ? (r.canPropose ? [reply, { id: newId(), type: "ai-proposal" as const, proposalId, at: nowLabel() }] : [reply]) : [m])));
        })
        .catch(() => {
          const reply: ChatItem = {
            id: newId(),
            type: "ai-reply",
            reply: { kind: "notice", title: "AI가 대화를 정리하지 못했어요", basis: "잠시 뒤 다시 부탁해 주세요 · 그동안 대화는 계속할 수 있어요", items: [] },
            at: nowLabel(),
          };
          replaceItem(workingId, reply);
        });
    } else if (callsAi) {
      // 요약·할 일·자료·회의록 등: 잠깐 '정리하고 있어요'를 보여준 뒤 답 카드로 바꿔요
      const thinkingId = newId();
      setExtra((prev) => [...prev, mine, { id: thinkingId, type: "ai-thinking", at }]);
      const t = setTimeout(() => {
        replaceItem(thinkingId, { id: newId(), type: "ai-reply", reply: getAiReply(teamId, text), at: nowLabel() });
      }, THINKING_MS);
      timers.current.push(t);
    } else {
      setExtra((prev) => [...prev, mine]);
    }
  };

  // 실패 카드의 버튼들
  const retry = () => {
    const failed = extra.find((m) => m.type === "ai-failed");
    if (!failed) return;
    const workingId = newId();
    replaceItem(failed.id, { id: workingId, type: "ai-working", proposalId, at: nowLabel() });
    runAi(workingId, false); // 다시 시도하면 성공해요
  };
  const timeOnly = () => {
    const failed = extra.find((m) => m.type === "ai-failed");
    if (failed) replaceItem(failed.id, { id: newId(), type: "ai-proposal", proposalId, at: nowLabel() });
  };

  /** 입력칸에 글을 채우고 도움말 패널 열기 */
  const fillDraft = (text: string) => {
    setDraft(text);
    setHelpOpen(true);
    inputRef.current?.focus();
  };

  // 위 요약 줄
  const meetings = getTeamMeetings(teamId, isConfirmed, state.cProposal);
  const hasProposalCard = items.some((m) => m.type === "ai-proposal");
  const upcoming = meetings.upcoming[0];
  const showProposal = !!meetings.proposal && hasProposalCard;
  const meetingText = upcoming
    ? meetingLine(upcoming, state)
    : showProposal && meetings.proposal
      ? `${shortTitle(meetings.proposal)} · 응답 마감 ${meetings.proposal.deadline}`
      : null;
  const hideBar = !!liveTeam || (fresh && !isConfirmed && !hasProposalCard); // AI에게 부탁하기 전에는 요약이 없어요
  const newCount = liveTeam ? 0 : (showProposal ? 1 : 0) + getFiles(teamId).filter((f) => f.isNew).length;

  return (
    <main className="screen">
      <TopBar
        plain
        back="/home"
        backLabel="홈으로"
        title={team.name}
        sub={`${team.memberIds.length}명 · AI 도우미 ${aiOn ? "켜짐" : "꺼짐"}`}
        right={
          <>
            <button type="button" className="icon-btn" aria-label="대화 검색" onClick={() => toast.show("준비 중이에요")}>
              <Icon name="search" size={21} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={newCount ? `팀 메뉴 열기, 새 항목 ${newCount}개` : "팀 메뉴 열기"}
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" size={21} />
              {newCount ? <span className="count-badge">{newCount}</span> : null}
            </button>
          </>
        }
      />

      {!hideBar ? (
        <SummaryBar
          meetingText={meetingText}
          confirmedHref={upcoming ? `/meetings/${upcoming.id}` : null}
          taskText={taskSummary(teamId, state)}
          onOpen={() => setMenuOpen(true)}
        />
      ) : null}

      <div ref={bodyRef} className="screen__body" style={{ borderTop: hideBar ? "1px solid var(--line)" : undefined }} onClick={() => setHelpOpen(false)}>
        {/* 메시지를 아래쪽에 붙이는 빈칸 */}
        <div style={{ marginTop: "auto" }} />
        {items.length === 0 ? (
          <div className="stack gap-8 t-center" style={{ alignItems: "center", margin: "auto 0", padding: "0 24px" }}>
            <AiAvatar size={48} />
            <span className="t-15 t-strong">아직 대화가 없어요</span>
            <span className="t-13 t-muted" style={{ lineHeight: 1.5 }}>
              첫 메시지를 남기거나 <span className="mention">@AI</span>로 회의를 잡아 보세요
            </span>
          </div>
        ) : (
          <ChatMessages
            items={items}
            viewerId={me.id}
            teamId={teamId}
            onOpenFiles={() => setMenuOpen(true)}
            onRetry={retry}
            onTimeOnly={timeOnly}
            onToast={toast.show}
          />
        )}
      </div>

      {helpOpen ? <AiHelpPanel onPick={fillDraft} /> : null}

      <Composer
        ref={inputRef}
        value={draft}
        joined={helpOpen}
        onChange={(v) => {
          setDraft(v);
          // '@'를 치면 AI 도움말이 뜨고, '@'를 지우면 닫혀요
          setHelpOpen(v.includes("@"));
        }}
        onCallAi={() => fillDraft("@AI ")}
        onSend={send}
        onPlus={() => {
          setHelpOpen(false);
          setShareOpen(true);
        }}
      />

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onAiMeeting={() => {
          setShareOpen(false);
          fillDraft(AI_CHIPS[0].text);
        }}
        onAiHelp={() => {
          setShareOpen(false);
          fillDraft("@AI ");
        }}
        onSoon={() => toast.show("준비 중이에요")}
      />

      <TeamDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        team={team}
        confirmed={isConfirmed}
        aiOn={aiOn}
        onAiChange={setAiOn}
        onToast={toast.show}
      />

      <Toast message={toast.message} />
    </main>
  );
}
