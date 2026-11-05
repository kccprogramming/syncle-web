"use client";

/**
 * 3 대화방 (/teams/[teamId])
 * 쿼리: ?fresh=1 AI 부르기 전 · ?fail=1 AI 정리 실패 시연 · ?share=1 + 메뉴 · ?menu=1 팀 메뉴
 * 회의가 확정되면(state.confirmed) 3-4 확정 뒤 대화로 바뀌어요.
 */
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useDemo } from "@/lib/demo-store";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { loadTeam } from "@/lib/data";
import { isLiveId } from "@/lib/scheduling-client";
import type { Team } from "@/types";

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
  // 진짜 팀(Supabase UUID)이면 A에서 팀 정보를 먼저 불러와요. undefined = 불러오는 중, null = 못 찾음
  const live = isLiveId(teamId);
  const [liveTeam, setLiveTeam] = useState<Team | null | undefined>(undefined);
  useEffect(() => {
    if (live) loadTeam(teamId).then(setLiveTeam).catch(() => setLiveTeam(null));
  }, [live, teamId]);

  if (live && liveTeam === undefined) return null;
  if (live && !liveTeam) {
    return (
      <main className="screen" style={{ justifyContent: "center", alignItems: "center", gap: 8, padding: 24 }}>
        <span className="t-15 t-strong">팀을 찾지 못했어요</span>
        <span className="t-13 t-muted">로그인했는지, 이 팀의 팀원인지 확인해 주세요</span>
      </main>
    );
  }

  return (
    <ChatRoom
      key={liveTeam?.id ?? teamId}
      liveTeam={liveTeam ?? undefined}
      teamId={teamId}
      confirmed={state.confirmed}
      fresh={sp.get("fresh") === "1"}
      fail={sp.get("fail") === "1"}
      startShare={sp.get("share") === "1"}
      startMenu={sp.get("menu") === "1"}
    />
  );
}
