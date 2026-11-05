"use client";

/** 3-2-4 팀 설정 (/teams/[teamId]/settings) */
import { useParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Avatar, TeamBadge } from "@/components/Avatar";
import { Switch } from "@/components/Controls";
import { Toast, useToast } from "@/components/Toast";
import { getMe, getMember, getMembers, getTeam } from "@/lib/data";
import { useDemo } from "@/lib/demo-store";
import { DEMO_TEAM_ID, copyInviteLink, useTeamAi } from "@/components/chat/team-info";

const SCOPES = [
  { id: "all", title: "팀 대화 전체", note: "일정·마감을 알아서 찾아요" },
  { id: "mention", title: "@AI 부를 때만", note: "부른 앞뒤 대화만 읽어요" },
] as const;

export default function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const team = getTeam(teamId);
  const me = getMe();
  const { state, update } = useDemo();
  const { aiOn, setAiOn } = useTeamAi(team);
  const toast = useToast();

  const isDemo = teamId === DEMO_TEAM_ID;
  const scope = isDemo ? state.aiScope : team.aiScope;
  const owner = getMember(team.ownerId);
  const iAmOwner = team.ownerId === me.id;

  return (
    <main className="screen">
      <TopBar back={`/teams/${teamId}?menu=1`} backLabel="팀 메뉴로" title="팀 설정" />

      <div className="screen__body" style={{ padding: "14px 16px" }}>
        {/* 팀 이름 */}
        <section className="card" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TeamBadge initial={team.initial} color={team.color} ink={team.ink} size={48} />
          <div className="stack gap-2 grow">
            <span style={{ fontSize: 16, fontWeight: 600 }}>{team.name}</span>
            <span className="t-12 t-muted">
              {team.createdLabel} 만듦 · 방장 {owner.name}
            </span>
          </div>
          <button type="button" className="btn btn--ghost btn--sm no-shrink" style={{ fontSize: 12 }} onClick={() => toast.show("준비 중이에요")}>
            이름 수정
          </button>
        </section>

        {/* 팀원 */}
        <section className="card" style={{ padding: "6px 16px", gap: 0 }}>
          <div className="hstack" style={{ padding: "8px 0 4px" }}>
            <h2 className="t-15 t-strong grow">팀원 {team.memberIds.length}명</h2>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ height: 32, fontSize: 12 }}
              onClick={() => {
                copyInviteLink(team);
                toast.show("초대 링크가 복사되었어요");
              }}
            >
              + 초대 링크 복사
            </button>
          </div>
          {getMembers(team.memberIds).map((m) => (
            <div key={m.id} className="hstack gap-12" style={{ minHeight: 52, borderBottom: "1px solid var(--line-2)" }}>
              <Avatar member={m} size={32} />
              <span className="t-14 grow">
                {m.name}
                {m.id === me.id ? " (나)" : ""}
              </span>
              {m.id === team.ownerId ? <span className="tag tag--soft">방장</span> : null}
            </div>
          ))}
          <button
            type="button"
            className="t-13 t-accent"
            style={{ minHeight: 44, border: 0, background: "none", textAlign: "left", padding: 0 }}
            onClick={() => toast.show("준비 중이에요")}
          >
            방장 넘기기 ›
          </button>
        </section>

        {/* AI 도우미 */}
        <section className="card card--flush">
          <div className="hstack gap-10" style={{ minHeight: 56, padding: "0 16px" }}>
            <span className="stack grow" style={{ gap: 1 }}>
              <span className="t-14">AI 도우미</span>
              <span className="t-12 t-muted">끄면 AI가 이 대화방을 읽지 않아요</span>
            </span>
            <Switch on={aiOn} onChange={setAiOn} label="AI 도우미" />
          </div>
          <div className="divider" style={{ margin: "0 16px" }} />
          <div className="stack gap-8" style={{ padding: "12px 16px 14px", opacity: aiOn ? 1 : 0.5 }}>
            <span className="t-14">AI가 읽는 범위</span>
            <div className="btn-row" role="radiogroup" aria-label="AI가 읽는 범위">
              {SCOPES.map((c) => {
                const on = scope === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!aiOn}
                    className={`option${on ? " option--on" : ""}`}
                    style={{ minHeight: 52, padding: "6px 8px", flexDirection: "column", justifyContent: "center", gap: 1 }}
                    onClick={() => (isDemo ? update({ aiScope: c.id }) : toast.show("준비 중이에요"))}
                  >
                    <span className="t-13 t-strong">{c.title}</span>
                    <span className="t-muted" style={{ fontSize: 11 }}>
                      {c.note}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <button type="button" className="btn btn--danger t-14 no-shrink" onClick={() => toast.show(iAmOwner ? "방장을 먼저 넘겨 주세요" : "준비 중이에요")}>
          팀 나가기
        </button>
        <span className="t-12 t-muted t-center" style={{ marginTop: -4 }}>
          방장은 다른 팀원에게 방장을 넘긴 뒤 나갈 수 있어요
        </span>
      </div>

      <Toast message={toast.message} bottom={40} />
    </main>
  );
}
