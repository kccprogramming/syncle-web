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
import { MAX_UPLOAD_BYTES, fileSizeLabel, isImageName, teamImageUrls, askTeamAi, postAiReplyCard, createTeamTask, getAiReply, getFiles, getMe, getMessages, getTeam, loadTeamMembers, postProposalCard, loadTeamMessages, myUserId, requestAi, sendTeamMessage, subscribeTeamMessages, teamFileUrl, uploadTeamFile } from "@/lib/data";
import type { Message, Team } from "@/types";
import { isSchedulingRequest } from "@/lib/place-intent";
import { useDemo } from "@/lib/demo-store";
import { AI_CHIPS, AiHelpPanel } from "./AiHelpPanel";
import { ChatMessages, useDemoCardInfo, type ChatItem } from "./ChatMessages";
import { Composer } from "./Composer";
import { ShareSheet, type UploadKind } from "./ShareSheet";
import { TaskSheet } from "./TaskSheet";
import { CreateProposalSheet } from "./CreateProposalSheet";
import { SummaryBar } from "./SummaryBar";
import { TeamDrawer } from "./TeamDrawer";
import { DEMO_TEAM_ID, getTeamMeetings, getTeamProposal, meetingLine, shortTitle, taskSummary, useDemoSchedule, useTeamAi } from "./team-info";

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
  /** 진짜 팀(A · Supabase). 있으면 데모 대화 대신 이 팀의 진짜 메시지를 읽고 보내요 (실시간) */
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
  const toast = useToast();
  const { aiOn, setAiOn } = useTeamAi(team, toast.show);

  const [extra, setExtra] = useState<ChatItem[]>([]); // 이 화면에서 새로 보낸 메시지들
  // 진짜 팀: 화면에만 있는 카드('정리 중' · 실패 안내 · 올리는 중)가 어느 메시지 뒤에 생겼는지 { 카드 id: 메시지 id }.
  // 그 뒤에 온 메시지는 카드 아래로 쌓여요 (카드가 맨 아래에 붙어 있지 않게)
  const anchors = useRef<Record<string, string | null>>({});
  const liveMsgsRef = useRef<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(startShare);
  const [menuOpen, setMenuOpen] = useState(startMenu);
  const [uploading, setUploading] = useState<UploadKind | null>(null); // 올리는 중인 버튼 (사진 / 파일)
  const [taskOpen, setTaskOpen] = useState(false); // + 메뉴 → 할 일 추가 시트 (진짜 팀)
  const [proposalText, setProposalText] = useState<string | null>(null); // '@AI 회의 잡아줘' → 제안 만들기 시트 (진짜 팀)
  // 사진 메시지의 미리보기 주소 { 메시지 id: 주소 }
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 화면을 떠나면 기다리던 타이머 정리
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // ── 진짜 팀: 메시지 읽기 · 실시간 받기 (A · Supabase) ──
  const [liveMsgs, setLiveMsgs] = useState<Message[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [, setMembersVersion] = useState(0); // 팀원 이름을 새로 불러오면 다시 그려요
  useEffect(() => {
    if (!liveTeam) return;
    let gone = false;
    const addOnce = (m: Message) => setLiveMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    const known = new Set(liveTeam.memberIds);
    Promise.all([myUserId(), loadTeamMembers(liveTeam.memberIds), loadTeamMessages(liveTeam.id)])
      .then(([id, , msgs]) => {
        if (gone) return;
        setMeId(id);
        setMembersVersion((v) => v + 1);
        setLiveMsgs(msgs);
      })
      .catch(() => !gone && toast.show("대화를 불러오지 못했어요 · 새로고침해 주세요"));
    const stop = subscribeTeamMessages(liveTeam.id, (m, senderId) => {
      // 새로 들어온 팀원이 보낸 메시지면 이름을 다시 불러와요
      if (senderId && !known.has(senderId)) {
        known.add(senderId);
        void loadTeamMembers([senderId]).then(() => setMembersVersion((v) => v + 1));
      }
      addOnce(m);
    });
    return () => {
      gone = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTeam]);

  // 진짜 팀: 아직 주소가 없는 사진 메시지의 미리보기 주소를 받아와요 (새로 온 사진도)
  useEffect(() => {
    if (!liveTeam) return;
    const need = liveMsgs.filter((m) => m.type === "file" && isImageName(m.fileName) && !imageUrls[m.id]).map((m) => m.id);
    if (need.length === 0) return;
    let gone = false;
    // 올린 직후에는 팀 자료 저장이 조금 늦을 수 있어서 한 번 더 기다렸다가 받아요
    const fetchUrls = (retry: boolean) =>
      teamImageUrls(need).then((urls) => {
        if (gone) return;
        if (Object.keys(urls).length) setImageUrls((prev) => ({ ...prev, ...urls }));
        if (retry && Object.keys(urls).length < need.length) setTimeout(() => !gone && void fetchUrls(false), 1500);
      });
    void fetchUrls(true);
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTeam, liveMsgs]);

  // 서버 메시지 + 이 화면에서 보낸 메시지
  liveMsgsRef.current = liveMsgs;
  let base: ChatItem[] = liveTeam ? liveMsgs : getMessages(teamId, isConfirmed);
  if (fresh && !isConfirmed) base = base.filter((m) => m.type === "text" || m.type === "file");
  // 실제 앱처럼 '나에게만' 질문 카드는 대화방에 보여주지 않아요 (데모도 같게)
  base = base.filter((m) => m.type !== "ai-question");
  const items = liveTeam ? placeExtras(liveMsgs, extra, anchors.current) : [...base, ...extra];

  /** 진짜 팀: 화면에만 있는 카드를 지금 마지막 메시지(또는 afterId) 뒤에 붙여요 */
  const addLocal = (item: ChatItem, afterId?: string) => {
    if (liveTeam) anchors.current[item.id] = afterId ?? liveMsgsRef.current.at(-1)?.id ?? null;
    setExtra((prev) => [...prev, item]);
  };

  // ── 스크롤: 맨 아래를 보고 있을 때만 새 메시지를 따라 내려가요 ──
  // 위쪽 대화를 읽는 중이면 그대로 두고 '새 메시지 ↓' 버튼만 보여줘요. 내가 보낸 메시지는 항상 내려가요.
  const atBottom = useRef(true);
  const lastSeen = useRef<string | null>(null); // 마지막으로 처리한 맨 아래 항목 id
  const [unread, setUnread] = useState(0);
  const viewerId = liveTeam ? (meId ?? "") : me.id;
  const scrollToBottom = useCallback((smooth = false) => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setUnread(0);
  }, []);
  const onBodyScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setUnread(0);
  };
  const lastItem = items.at(-1);
  useEffect(() => {
    if (!lastItem || lastItem.id === lastSeen.current) return;
    const first = lastSeen.current === null;
    lastSeen.current = lastItem.id;
    const mine = ("senderId" in lastItem && lastItem.senderId === viewerId) || lastItem.type === "ai-thinking" || lastItem.type === "ai-working";
    if (first || mine || atBottom.current) scrollToBottom();
    else setUnread((n) => n + 1);
  }, [lastItem, viewerId, scrollToBottom]);
  // AI 도움말을 열고 닫을 때는 아래를 보고 있었을 때만 맞춰요
  useEffect(() => {
    if (atBottom.current) scrollToBottom();
  }, [helpOpen, scrollToBottom]);

  /** 목록에서 id가 같은 카드를 다른 카드로 바꾸기 */
  const replaceItem = useCallback((id: string, next: ChatItem) => {
    if (id in anchors.current) anchors.current[next.id] = anchors.current[id];
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

  /** 진짜 팀 '@AI 요약 · 할 일 · 자료 정리' → B 답 카드를 대화방에 남겨요 (실패 안내는 내 화면에만) */
  const askCard = (liveTeamId: string, text: string, afterId: string) => {
    const thinkingId = newId();
    addLocal({ id: thinkingId, type: "ai-thinking", at: nowLabel() }, afterId);
    const fail = (title: string, basis = "잠시 뒤 다시 부탁해 주세요 · 그동안 대화는 계속할 수 있어요") =>
      replaceItem(thinkingId, { id: newId(), type: "ai-reply", reply: { kind: "notice", title, basis, items: [] }, at: nowLabel() });
    askTeamAi(liveTeamId, text)
      .then((reply) => {
        // 안내 카드(읽을 대화가 없어요 등)는 저장하지 않고 내 화면에만
        if (reply.kind === "notice") return replaceItem(thinkingId, { id: newId(), type: "ai-reply", reply, at: nowLabel() });
        return postAiReplyCard(liveTeamId, reply)
          .then((m) => {
            setExtra((prev) => prev.filter((x) => x.id !== thinkingId));
            setLiveMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          })
          .catch(() => {
            // 저장이 안 되면 내 화면에만 보여 줘요
            replaceItem(thinkingId, { id: newId(), type: "ai-reply", reply, at: nowLabel() });
            toast.show("AI 카드를 팀원에게 공유하지 못했어요 · 내 화면에만 보여요");
          });
      })
      .catch((e) => fail(e instanceof Error ? e.message : "AI가 정리하지 못했어요"));
  };

  const send = () => {
    // '@ai', '@Ai'처럼 직접 쳐도 AI를 부른 걸로 알아들어요 (B · 화면은 '@AI'를 찾아요)
    const text = draft.trim().replace(/@ai(?![A-Za-z0-9_])/gi, "@AI");
    if (!text) return;
    if (liveTeam) {
      // 진짜 팀: Supabase에 저장하면 실시간으로 팀원 화면에도 떠요
      setDraft("");
      setHelpOpen(false);
      const callsAi = text.includes("@AI");
      if (callsAi && !aiOn) toast.show("AI 도우미가 꺼져 있어요");
      // '@AI … 잡아줘'면 마감을 정하는 시트를 열어 C에 제안을 만들어요
      else if (callsAi && isSchedulingRequest(text)) setProposalText(text);
      const asksCard = callsAi && aiOn && !isSchedulingRequest(text);
      sendTeamMessage(liveTeam.id, text)
        .then((m) => {
          setLiveMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          // 요약 · 할 일 · 자료 정리: 내 메시지 바로 아래에 '정리 중'을 띄우고,
          // B 답 카드를 대화방에 저장해요 → 팀원 모두에게 보여요 (실시간)
          if (asksCard) askCard(liveTeam.id, text, m.id);
        })
        .catch(() => {
          setDraft(text);
          toast.show("메시지를 보내지 못했어요 · 다시 보내 주세요");
        });
      return;
    }
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

  /** + 메뉴에서 사진 · 파일을 골랐을 때: 진짜 팀이면 팀 자료에 올리고 대화방에 파일 말풍선을 남겨요 */
  const pickFile = (file: File, kind: UploadKind) => {
    if (file.size > MAX_UPLOAD_BYTES) return toast.show("20MB 이하 파일만 올릴 수 있어요");
    if (!liveTeam) {
      // 데모 팀: 올리지 않고 화면에만 보여줘요
      setShareOpen(false);
      const id = newId();
      if (isImageName(file.name)) setImageUrls((prev) => ({ ...prev, [id]: URL.createObjectURL(file) }));
      setExtra((prev) => [...prev, { id, type: "file", senderId: me.id, fileName: file.name, size: fileSizeLabel(file.size), at: nowLabel() }]);
      return toast.show("데모 팀이라 화면에만 보여요");
    }
    // 고르면 바로 시트를 닫고, 대화방에 '올리는 중…' 말풍선을 먼저 보여줘요 (사진은 고른 사진 그대로)
    setShareOpen(false);
    setUploading(kind);
    const tempId = newId();
    const preview = isImageName(file.name) ? URL.createObjectURL(file) : null;
    if (preview) setImageUrls((prev) => ({ ...prev, [tempId]: preview }));
    addLocal({ id: tempId, type: "file", senderId: meId ?? me.id, fileName: file.name, size: fileSizeLabel(file.size), at: nowLabel(), uploading: true });
    const dropTemp = () => setExtra((prev) => prev.filter((m) => m.id !== tempId));
    uploadTeamFile(liveTeam.id, file)
      .then((m) => {
        // 올린 사진은 내 기기에 있는 걸로 계속 보여줘요
        if (preview) setImageUrls((prev) => ({ ...prev, [m.id]: preview }));
        dropTemp();
        setLiveMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .catch((e) => {
        dropTemp();
        toast.show(e instanceof Error ? e.message : "파일을 올리지 못했어요");
      })
      .finally(() => setUploading(null));
  };

  /** 파일 말풍선: 진짜 팀이면 파일을 새 탭으로 열어요 (1시간 동안 열리는 주소) */
  const openFile = (messageId?: string) => {
    if (!liveTeam || !messageId) return setMenuOpen(true);
    const tab = window.open("", "_blank"); // 기다린 뒤 열면 막히는 브라우저가 있어서 먼저 열어 둬요
    teamFileUrl(messageId)
      .then((url) => {
        if (url && tab) tab.location.href = url;
        else {
          tab?.close();
          toast.show("파일을 찾지 못했어요");
        }
      })
      .catch(() => {
        tab?.close();
        toast.show("파일을 열지 못했어요");
      });
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
  const demoSchedule = useDemoSchedule(menuOpen); // 데모 팀: 실제 화면에서 응답 · 확정한 상태 (메뉴를 닫을 때도 다시 읽어요)
  const meetings = getTeamMeetings(teamId, isConfirmed, state.cProposal, demoSchedule);
  const hasProposalCard = items.some((m) => m.type === "ai-proposal");
  const upcoming = meetings.upcoming[0];
  const showProposal = !!meetings.proposal && hasProposalCard;
  // 데모 제안은 실제 화면과 같은 날짜(오늘 기준)로
  const demoInfo = useDemoCardInfo(meetings.proposal?.id ?? "");
  const meetingText = upcoming
    ? meetingLine(upcoming, state)
    : showProposal && meetings.proposal
      ? `${shortTitle(meetings.proposal)} · ${demoInfo ? demoInfo.sub.split(" · ")[0] : `응답 마감 ${meetings.proposal.deadline}`}`
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

      <div ref={bodyRef} className="screen__body" style={{ borderTop: hideBar ? "1px solid var(--line)" : undefined }} onClick={() => setHelpOpen(false)} onScroll={onBodyScroll}>
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
            viewerId={viewerId}
            teamId={teamId}
            onOpenFiles={openFile}
            imageUrls={imageUrls}
            onRetry={retry}
            onTimeOnly={timeOnly}
            onToast={toast.show}
            onAddTask={
              liveTeam
                ? async (it) => {
                    try {
                      await createTeamTask(liveTeam.id, { title: it.text, assigneeId: it.assigneeId ?? null, due: it.due ?? null });
                      toast.show(`할 일을 추가했어요 · ${it.text}`);
                    } catch (e) {
                      toast.show(e instanceof Error ? e.message : "할 일을 추가하지 못했어요");
                      throw e;
                    }
                  }
                : undefined
            }
          />
        )}
      </div>
      {unread > 0 ? (
        <div style={{ position: "relative", height: 0 }}>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", boxShadow: "0 4px 12px rgba(0,0,0,.15)", zIndex: 5 }}
            onClick={() => scrollToBottom(true)}
          >
            새 메시지 {unread}개 ↓
          </button>
        </div>
      ) : null}

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
        onPickFile={pickFile}
        uploading={uploading}
        onTask={
          liveTeam
            ? () => {
                setShareOpen(false);
                setTaskOpen(true);
              }
            : undefined
        }
      />

      {proposalText !== null && liveTeam ? (
        <CreateProposalSheet
          teamId={liveTeam.id}
          teamName={liveTeam.name}
          request={proposalText}
          onClose={() => setProposalText(null)}
          onMessage={(m) => setLiveMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))}
          onCreated={(p) => {
            setProposalText(null);
            postProposalCard(liveTeam.id, p)
              .then((m) => setLiveMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])))
              .catch(() => toast.show("제안은 만들었지만 대화방 카드를 남기지 못했어요 · 팀 메뉴의 회의에서 열 수 있어요"));
          }}
        />
      ) : null}

      {taskOpen && liveTeam ? (
        <TaskSheet
          teamId={liveTeam.id}
          memberIds={liveTeam.memberIds}
          meId={meId}
          onClose={() => setTaskOpen(false)}
          onCreated={(t) => {
            setTaskOpen(false);
            toast.show(`할 일을 추가했어요 · ${t.title}`);
          }}
        />
      ) : null}

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

/**
 * 진짜 팀: 서버 메시지 사이에 화면에만 있는 카드를 끼워요.
 * 카드는 만들 때의 마지막 메시지(anchors) 바로 뒤에 오고, 그 뒤에 온 메시지는 카드 아래로 쌓여요.
 */
function placeExtras(msgs: Message[], extra: ChatItem[], anchors: Record<string, string | null>): ChatItem[] {
  const after = new Map<string | null, ChatItem[]>();
  const known = new Set(msgs.map((m) => m.id));
  const tail: ChatItem[] = [];
  for (const x of extra) {
    const a = anchors[x.id];
    if (a === undefined || (a !== null && !known.has(a))) tail.push(x);
    else after.set(a, [...(after.get(a) ?? []), x]);
  }
  const out: ChatItem[] = [...(after.get(null) ?? [])];
  for (const m of msgs) out.push(m, ...(after.get(m.id) ?? []));
  return [...out, ...tail];
}
