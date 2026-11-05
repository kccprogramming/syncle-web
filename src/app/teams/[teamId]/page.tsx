"use client";

/**
 * 3 대화방 (/teams/[teamId])
 * 쿼리: ?fresh=1 AI 부르기 전 · ?fail=1 AI 정리 실패 시연 · ?share=1 + 메뉴 · ?menu=1 팀 메뉴
 * 회의가 확정되면(state.confirmed) 3-4 확정 뒤 대화로 바뀌어요.
 */
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useDemo } from "@/lib/demo-store";
import { ChatRoom } from "@/components/chat/ChatRoom";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { teamId } = useParams<{ teamId: string }>();
  const sp = useSearchParams();
  const { state } = useDemo();

  return (
    <ChatRoom
      teamId={teamId}
      confirmed={state.confirmed}
      fresh={sp.get("fresh") === "1"}
      fail={sp.get("fail") === "1"}
      startShare={sp.get("share") === "1"}
      startMenu={sp.get("menu") === "1"}
    />
  );
}
