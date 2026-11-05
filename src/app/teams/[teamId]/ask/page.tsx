"use client";

/**
 * 3-3 지우님 화면 (/teams/[teamId]/ask)
 * 아직 응답하지 않은 지우에게 보이는 대화방. AI가 지우에게만 되는 시간을 물어봐요.
 */
import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { Toast, useToast } from "@/components/Toast";
import { getMessages, getTeam } from "@/lib/data";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { useTeamAi } from "@/components/chat/team-info";

/** 이 화면을 보는 사람 (지우) */
const VIEWER_ID = "u-jiwoo";

export default function AskReplyPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const team = getTeam(teamId);
  const { aiOn } = useTeamAi(team);
  const toast = useToast();
  const bodyRef = useRef<HTMLDivElement>(null);

  // 처음 열면 맨 아래(AI 카드)가 보이게
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, []);

  // 지우에게는 회의 제안 카드 대신 '시간 묻기' 카드가 보여요
  const items = getMessages(teamId).filter((m) => m.type !== "ai-proposal");

  return (
    <main className="screen">
      <TopBar
        back="/home"
        backLabel="홈으로"
        title={team.name}
        sub={`${team.memberIds.length}명 · AI 도우미 ${aiOn ? "켜짐" : "꺼짐"}`}
        right={
          <span className="tag tag--gray" style={{ fontWeight: 600, borderRadius: 8, padding: "3px 8px", marginRight: 4 }}>
            지우님 화면
          </span>
        }
      />

      <div ref={bodyRef} className="screen__body">
        <div style={{ marginTop: "auto" }} />
        <ChatMessages items={items} viewerId={VIEWER_ID} teamId={teamId} onOpenFiles={() => toast.show("준비 중이에요")} onToast={toast.show} />
      </div>

      {/* 다른 사람 화면이라 입력줄은 모양만 보여요 */}
      <div className="composer" aria-hidden="true">
        <span className="composer__plus">
          <Icon name="plus" size={20} strokeWidth={2.2} />
        </span>
        <span className="composer__input hstack" style={{ color: "var(--faint)" }}>
          메시지 입력
        </span>
      </div>

      <Toast message={toast.message} />
    </main>
  );
}
