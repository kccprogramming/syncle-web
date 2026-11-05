"use client";

/**
 * 0-2 초대 링크로 들어온 로그인 — 어떤 팀에 초대됐는지 먼저 보여줘요.
 * 진짜 초대 코드(32자리)면 A의 preview_team_invite로 팀을 보여줘요 (로그인 전에도 돼요). 데모 코드면 가짜 데이터.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/Logo";
import { TeamBadge } from "@/components/Avatar";
import { LoginButtons } from "@/components/home/LoginButtons";
import { getInvite, isLiveInviteCode, previewInvite } from "@/lib/data";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const live = isLiveInviteCode(code);
  const demo = getInvite(code);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewInvite>> | undefined>(undefined);
  useEffect(() => {
    if (live) previewInvite(code).then(setPreview).catch(() => setPreview(null));
  }, [live, code]);
  const team = live
    ? { name: preview?.teamName ?? (preview === null ? "초대 코드를 찾지 못했어요" : "팀을 찾는 중…"), initial: Array.from(preview?.teamName ?? "팀")[0], color: "#DDE6F7", ink: "#23407A", aiEnabled: true }
    : demo.team;
  const inviterName = live ? (preview?.inviterName ?? "팀원") : demo.inviterName;
  const memberCount = live ? (preview?.memberCount ?? 0) : demo.memberNames.length;

  return (
    <main className="screen screen--white" style={{ padding: "0 24px 32px" }}>
      <div className="stack grow" style={{ alignItems: "center", justifyContent: "center", gap: 28 }}>
        <div className="stack gap-10" style={{ alignItems: "center" }}>
          <LogoMark size={56} label="싱클 로고" />
          <Wordmark size={28} />
        </div>

        <section
          aria-label="받은 초대"
          className="stack gap-10 t-center"
          style={{ width: "100%", border: "1px solid var(--line)", borderRadius: "var(--radius-xl)", padding: 18, alignItems: "center" }}
        >
          <TeamBadge initial={team.initial} color={team.color} ink={team.ink} size={52} />
          <div className="stack gap-4">
            {(!live || preview) && <span className="t-13 t-muted">{inviterName}님이 초대했어요</span>}
            <h1 style={{ fontSize: 19, fontWeight: 700 }}>{team.name}</h1>
            {(!live || preview) && (
              <span className="t-13 t-muted">
                {memberCount}명 참여 중{live ? "" : ` · AI 도우미 ${team.aiEnabled ? "켜짐" : "꺼짐"}`}
              </span>
            )}
          </div>
        </section>

        <p className="t-14 t-ink2">로그인하면 바로 이 팀에 참여해요</p>
      </div>
      <LoginButtons href={`/join?code=${code}`} next={`/join?code=${code}`} />
    </main>
  );
}
