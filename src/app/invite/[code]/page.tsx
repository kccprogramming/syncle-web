"use client";

/** 0-2 초대 링크로 들어온 로그인 — 어떤 팀에 초대됐는지 먼저 보여줘요. */
import { useParams } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/Logo";
import { TeamBadge } from "@/components/Avatar";
import { LoginButtons } from "@/components/home/LoginButtons";
import { getInvite } from "@/lib/data";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const invite = getInvite(code);
  const { team } = invite;

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
            <span className="t-13 t-muted">{invite.inviterName}님이 초대했어요</span>
            <h1 style={{ fontSize: 19, fontWeight: 700 }}>{team.name}</h1>
            <span className="t-13 t-muted">
              {invite.memberNames.length}명 참여 중 · AI 도우미 {team.aiEnabled ? "켜짐" : "꺼짐"}
            </span>
          </div>
        </section>

        <p className="t-14 t-ink2">로그인하면 바로 이 팀에 참여해요</p>
      </div>
      <LoginButtons href={`/join?code=${code}`} />
    </main>
  );
}
