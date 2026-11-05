"use client";

/**
 * 대화 메시지 목록. 메시지 type마다 다른 모양으로 그려요.
 * 같은 사람이 연달아 보낸 메시지는 프로필을 한 번만 보여요.
 */
import { Fragment } from "react";
import { Avatar } from "@/components/Avatar";
import { AiAvatar } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { getMember } from "@/lib/data";
import type { AiReply, Message } from "@/types";
import { AiFailedCard, AiReplyCard, AiThinkingCard, AiWorkingCard, ConfirmedCard, LiveCard, ProposalCard } from "./AiCards";
import { AskQuestionCard } from "./AskQuestionCard";

/** 화면에서만 잠깐 쓰는 AI 상태 카드 (서버 메시지가 아니에요) */
export type ChatItem =
  | Message
  | { id: string; type: "ai-working" | "ai-failed"; proposalId: string; at: string }
  /** 요약·할 일 같은 부탁을 정리하는 동안 잠깐 */
  | { id: string; type: "ai-thinking"; at: string };

const AI_TYPES = ["ai-proposal", "ai-confirmed", "ai-question", "ai-working", "ai-failed", "ai-thinking", "ai-reply", "live-card"];

/** 누가 보낸 메시지인지 (AI 카드는 "ai", 시스템 줄은 매번 따로) */
function senderKey(item: ChatItem): string {
  if (item.type === "system") return `system-${item.id}`;
  if (AI_TYPES.includes(item.type)) return "ai";
  return "senderId" in item ? item.senderId : "?";
}

/** 연달아 같은 사람이 보낸 메시지끼리 묶기 */
function groupItems(items: ChatItem[]) {
  const groups: { key: string; items: ChatItem[] }[] = [];
  for (const item of items) {
    const key = senderKey(item);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

export function ChatMessages({
  items,
  viewerId,
  teamId,
  onOpenFiles,
  imageUrls,
  onRetry,
  onTimeOnly,
  onToast,
  onAddTask,
}: {
  items: ChatItem[];
  /** 지금 화면을 보는 사람. 이 사람이 보낸 메시지는 오른쪽에 파랗게 보여요. */
  viewerId: string;
  teamId: string;
  /** 파일 말풍선을 눌렀을 때 (진짜 팀이면 그 파일을 열고, 데모면 팀 메뉴를 열어요) */
  onOpenFiles: (messageId?: string) => void;
  /** 사진 메시지의 미리보기 주소 { 메시지 id: 주소 }. 있으면 파일 대신 사진으로 보여줘요 */
  imageUrls?: Record<string, string>;
  onRetry?: () => void;
  onTimeOnly?: () => void;
  onToast: (text: string) => void;
  /** 진짜 팀: AI 할 일 카드의 '추가'를 누르면 팀 할 일로 저장해요 */
  onAddTask?: (item: AiReply["items"][number]) => Promise<void>;
}) {
  // 받는 사람이 아니면 ai-question은 그리지 않아요
  const visible = items.filter((m) => m.type !== "ai-question" || m.visibleTo.includes(viewerId));

  return (
    <>
      {groupItems(visible).map((g) => {
        const first = g.items[0];

        if (first.type === "system") {
          return (
            <p key={first.id} className="system-line">
              {first.text}
            </p>
          );
        }

        // 내가 보낸 메시지: 오른쪽 파란 말풍선
        if (g.key === viewerId) {
          return (
            <div key={first.id} className="stack gap-4" style={{ alignItems: "flex-end" }}>
              {g.items.map((m, i) => (
                <Bubble key={m.id} item={m} mine first={i === 0} onOpenFiles={onOpenFiles} imageUrl={imageUrls?.[m.id]} />
              ))}
            </div>
          );
        }

        // 싱클 AI 카드
        if (g.key === "ai") {
          const onlyFor = first.type === "ai-question" ? ` · ${getMember(viewerId).name}님에게만 보여요` : "";
          return (
            <div key={first.id} className="msg">
              <AiAvatar size={36} />
              <div className="msg__col msg__col--wide">
                <span className="msg__name">싱클 AI{onlyFor}</span>
                {g.items.map((m) => (
                  <Fragment key={m.id}>{renderAiCard(m, { teamId, viewerId, onRetry, onTimeOnly, onToast, onAddTask })}</Fragment>
                ))}
              </div>
            </div>
          );
        }

        // 다른 팀원 메시지
        const sender = getMember(g.key);
        return (
          <div key={first.id} className="msg">
            <Avatar member={sender} size={36} />
            <div className="msg__col">
              <span className="msg__name">{sender.name}</span>
              {g.items.map((m, i) => (
                <Bubble key={m.id} item={m} mine={false} first={i === 0} onOpenFiles={onOpenFiles} imageUrl={imageUrls?.[m.id]} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function renderAiCard(
  m: ChatItem,
  o: { teamId: string; viewerId: string; onRetry?: () => void; onTimeOnly?: () => void; onToast: (t: string) => void; onAddTask?: (item: AiReply["items"][number]) => Promise<void> },
) {
  switch (m.type) {
    case "ai-proposal":
      return <ProposalCard proposalId={m.proposalId} teamId={o.teamId} />;
    case "ai-confirmed":
      return <ConfirmedCard meetingId={m.meetingId} />;
    case "ai-question":
      return <AskQuestionCard proposalId={m.proposalId} viewerId={o.viewerId} onToast={o.onToast} />;
    case "ai-working":
      return <AiWorkingCard proposalId={m.proposalId} />;
    case "ai-thinking":
      return <AiThinkingCard />;
    case "ai-reply":
      return <AiReplyCard reply={m.reply} askedBy={m.askedBy} onAddTask={m.reply.kind === "tasks" ? o.onAddTask : undefined} />;
    case "live-card":
      return <LiveCard kind={m.kind} proposalId={m.proposalId} title={m.title} sub={m.sub} />;
    case "ai-failed":
      return <AiFailedCard proposalId={m.proposalId} onRetry={o.onRetry ?? (() => {})} onTimeOnly={o.onTimeOnly ?? (() => {})} />;
    default:
      return null;
  }
}

/** 말풍선 하나 (글, @AI 부르기, 파일) */
function Bubble({ item, mine, first, onOpenFiles, imageUrl }: { item: ChatItem; mine: boolean; first: boolean; onOpenFiles: (messageId?: string) => void; imageUrl?: string }) {
  // 묶음의 첫 말풍선만 꼬리 쪽 모서리를 덜 둥글게
  const radius = first ? undefined : 14;

  // 사진: 미리보기 주소가 있으면 사진 그대로 보여줘요 (누르면 크게). 올리는 중이면 흐리게 + 안내
  if (item.type === "file" && imageUrl && item.uploading) {
    return (
      <div style={{ position: "relative", lineHeight: 0 }} aria-label={`${item.fileName} 올리는 중`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" style={{ width: 220, maxWidth: "100%", maxHeight: 260, objectFit: "cover", borderRadius: radius ?? 16, display: "block", opacity: 0.55 }} />
        <span className="t-12" style={{ position: "absolute", left: 8, bottom: 8, lineHeight: 1.4, padding: "2px 8px", borderRadius: 10, background: "rgba(0,0,0,0.55)", color: "#fff" }}>
          올리는 중…
        </span>
      </div>
    );
  }
  if (item.type === "file" && imageUrl) {
    return (
      <a href={imageUrl} target="_blank" rel="noreferrer" aria-label={`${item.fileName} 사진 크게 보기`} style={{ display: "block", lineHeight: 0 }}>
        {/* 비공개 보관함의 1시간짜리 주소라 next/image 최적화 대신 그대로 보여줘요 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={item.fileName}
          loading="lazy"
          style={{ width: 220, maxWidth: "100%", maxHeight: 260, objectFit: "cover", borderRadius: radius ?? 16, background: "var(--bg)", display: "block" }}
        />
      </a>
    );
  }

  if (item.type === "file") {
    return (
      <div className={`bubble${mine ? " bubble--mine" : ""} hstack gap-10`} style={{ padding: 12, borderRadius: radius }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={/\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)$/i.test(item.fileName) ? "image" : "file"} size={20} strokeWidth={1.8} />
        </div>
        <div className="stack gap-2" style={{ minWidth: 0 }}>
          <span className="t-14 t-strong" style={{ wordBreak: "break-all" }}>
            {item.fileName}
          </span>
          {item.uploading ? (
            <span className="t-12" style={{ padding: "2px 0", color: mine ? "#fff" : "var(--muted)", opacity: 0.85 }}>
              {item.size} · 올리는 중…
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onOpenFiles(item.id)}
              className="t-12"
              style={{ border: 0, background: "none", padding: "2px 0", textAlign: "left", color: mine ? "#fff" : "var(--accent)" }}
            >
              {item.size} · 팀 자료에 저장됨 ›
            </button>
          )}
        </div>
      </div>
    );
  }

  if (item.type === "text" || item.type === "mention-ai") {
    return (
      <p className={`bubble${mine ? " bubble--mine" : ""}`} style={{ borderRadius: radius, maxWidth: 260, wordBreak: "break-word" }}>
        {item.type === "mention-ai" ? (
          <>
            <span className="mention">@AI</span>{" "}
          </>
        ) : null}
        {item.text}
      </p>
    );
  }

  return null;
}
