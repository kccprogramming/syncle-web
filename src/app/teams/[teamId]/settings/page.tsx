"use client";

/**
 * 3-2-4 팀 설정 (/teams/[teamId]/settings)
 * 진짜 팀(A)이면 이름 · AI 도우미 · 읽는 범위(방장만) · 방장 넘기기 · 팀 나가기를 실제로 저장해요.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { TopBar } from "@/components/TopBar";
import { Avatar, TeamBadge } from "@/components/Avatar";
import { Switch } from "@/components/Controls";
import { Toast, useToast } from "@/components/Toast";
import { getMe, getMember, getMembers, getTeam, leaveTeam, loadTeam, removeTeamMember, loadTeamMembers, myUserId, transferTeamOwner, updateTeam } from "@/lib/data";
import { isLiveId } from "@/lib/scheduling-client";
import type { Team } from "@/types";
import { useDemo } from "@/lib/demo-store";
import { DEMO_TEAM_ID, copyInviteLink, useTeamAi } from "@/components/chat/team-info";

const SCOPES = [
  { id: "all", title: "팀 대화 전체", note: "일정·마감을 알아서 찾아요" },
  { id: "mention", title: "@AI 부를 때만", note: "부른 앞뒤 대화만 읽어요" },
] as const;

export default function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  // 진짜 팀(A)이면 팀 · 팀원 · 나를 먼저 불러와요
  const live = isLiveId(teamId);
  const [liveTeam, setLiveTeam] = useState<Team | null | undefined>(live ? undefined : null);
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    if (!live) return;
    let gone = false;
    Promise.all([loadTeam(teamId), myUserId()])
      .then(async ([t, id]) => {
        if (t) await loadTeamMembers(t.memberIds).catch(() => undefined);
        if (gone) return;
        setMeId(id);
        setLiveTeam(t);
      })
      .catch(() => !gone && setLiveTeam(null));
    return () => {
      gone = true;
    };
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
  return <Settings key={liveTeam?.id ?? teamId} teamId={teamId} initial={liveTeam ?? getTeam(teamId)} live={live} meId={live ? meId : getMe().id} />;
}

function Settings({ teamId, initial, live, meId }: { teamId: string; initial: Team; live: boolean; meId: string | null }) {
  const router = useRouter();
  const [team, setTeam] = useState(initial);
  const { state, update } = useDemo();
  const toast = useToast();
  const { aiOn, setAiOn } = useTeamAi(team, toast.show);
  const [sheet, setSheet] = useState<null | "name" | "owner" | "leave">(null);
  const [kick, setKick] = useState<string | null>(null); // 내보낼 팀원 id (확인 시트)
  const [busy, setBusy] = useState(false);
  const [leaveError, setLeaveError] = useState(""); // 나가기 시트 안에 보여줄 오류

  const isDemo = teamId === DEMO_TEAM_ID;
  const scope = isDemo ? state.aiScope : team.aiScope;
  const owner = getMember(team.ownerId);
  const iAmOwner = !!meId && team.ownerId === meId;
  const others = team.memberIds.filter((id) => id !== meId);

  /** 진짜 팀 저장 공통: 바로 바꿔 보여주고, 실패하면 되돌리고 알려줘요 */
  async function save(next: Partial<Team>, job: () => Promise<void>, done: string) {
    const prev = team;
    setTeam({ ...team, ...next });
    try {
      await job();
      toast.show(done);
    } catch (e) {
      setTeam(prev);
      toast.show(e instanceof Error ? e.message : "저장하지 못했어요");
    }
  }

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
              {team.createdLabel} 만듦 · 방장 {owner.name === "?" ? "팀원" : owner.name}
            </span>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm no-shrink"
            style={{ fontSize: 12 }}
            onClick={() => (!live ? toast.show("준비 중이에요") : iAmOwner ? setSheet("name") : toast.show("방장만 바꿀 수 있어요"))}
          >
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
                {m.id === meId ? " (나)" : ""}
              </span>
              {m.id === team.ownerId ? <span className="tag tag--soft">방장</span> : null}
              {live && iAmOwner && m.id !== meId ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm no-shrink"
                  style={{ height: 30, fontSize: 12, color: "var(--danger)" }}
                  aria-label={`${m.name}님 내보내기`}
                  onClick={() => setKick(m.id)}
                >
                  내보내기
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="t-13 t-accent"
            style={{ minHeight: 44, border: 0, background: "none", textAlign: "left", padding: 0 }}
            onClick={() =>
              !live
                ? toast.show("준비 중이에요")
                : !iAmOwner
                  ? toast.show("방장만 넘길 수 있어요")
                  : others.length === 0
                    ? toast.show("다른 팀원이 들어오면 넘길 수 있어요")
                    : setSheet("owner")
            }
          >
            방장 넘기기 ›
          </button>
        </section>

        {/* AI 도우미 */}
        <section className="card card--flush">
          <div className="hstack gap-10" style={{ minHeight: 56, padding: "0 16px" }}>
            <span className="stack grow" style={{ gap: 1 }}>
              <span className="t-14">AI 도우미</span>
              <span className="t-12 t-muted">끄면 AI가 이 대화방을 읽지 않아요{live && !iAmOwner ? " · 방장만 바꿀 수 있어요" : ""}</span>
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
                    onClick={() =>
                      isDemo
                        ? update({ aiScope: c.id })
                        : live
                          ? c.id !== scope && void save({ aiScope: c.id }, () => updateTeam(team.id, { aiScope: c.id }), "AI가 읽는 범위를 바꿨어요")
                          : toast.show("준비 중이에요")
                    }
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

        <button
          type="button"
          className="btn btn--danger t-14 no-shrink"
          onClick={() =>
            !live ? toast.show(iAmOwner ? "방장을 먼저 넘겨 주세요" : "준비 중이에요") : iAmOwner && others.length > 0 ? toast.show("방장을 먼저 다른 팀원에게 넘겨 주세요") : setSheet("leave")
          }
        >
          팀 나가기
        </button>
        <span className="t-12 t-muted t-center" style={{ marginTop: -4 }}>
          방장은 다른 팀원에게 방장을 넘긴 뒤 나갈 수 있어요
        </span>
      </div>

      <Toast message={toast.message} bottom={40} />

      {sheet === "name" ? (
        <NameSheet
          initial={team.name}
          onClose={() => setSheet(null)}
          onSave={(name) => {
            setSheet(null);
            void save({ name, initial: Array.from(name)[0] ?? team.initial }, () => updateTeam(team.id, { name }), "팀 이름을 바꿨어요");
          }}
        />
      ) : null}

      {sheet === "owner" ? (
        <Sheet open onClose={() => setSheet(null)} title="누구에게 방장을 넘길까요?" sub="넘기면 나는 일반 팀원이 돼요 · 팀 설정은 새 방장만 바꿀 수 있어요">
          <div className="stack">
            {others.map((id) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                className="hstack gap-12"
                style={{ minHeight: 52, border: 0, borderBottom: "1px solid var(--line-2)", background: "none", textAlign: "left" }}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await transferTeamOwner(team.id, id);
                    setTeam({ ...team, ownerId: id });
                    setSheet(null);
                    toast.show(`${getMember(id).name}님이 이제 방장이에요`);
                  } catch (e) {
                    toast.show(e instanceof Error ? e.message : "방장을 넘기지 못했어요");
                  }
                  setBusy(false);
                }}
              >
                <Avatar member={getMember(id)} size={32} />
                <span className="t-14 grow">{getMember(id).name === "?" ? "팀원" : getMember(id).name}</span>
                <span className="t-13 t-accent">넘기기 ›</span>
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}

      {kick ? (
        <Sheet
          open
          onClose={() => !busy && setKick(null)}
          title={`${getMember(kick).name === "?" ? "이 팀원" : getMember(kick).name + "님"}을 내보낼까요?`}
          sub="내보내면 이 팀의 대화와 자료를 볼 수 없어요. 그동안 쓴 대화 · 자료 · 할 일은 남아요. 다시 들어오려면 초대 링크가 필요해요."
        >
          <button
            type="button"
            className="btn btn--danger"
            style={{ height: 50 }}
            disabled={busy}
            onClick={async () => {
              const name = getMember(kick).name === "?" ? "팀원" : getMember(kick).name;
              setBusy(true);
              try {
                await removeTeamMember(team.id, kick, name);
                setTeam({ ...team, memberIds: team.memberIds.filter((id) => id !== kick) });
                setKick(null);
                toast.show(`${name}님을 내보냈어요`);
              } catch (e) {
                toast.show(e instanceof Error ? e.message : "내보내지 못했어요");
              }
              setBusy(false);
            }}
          >
            {busy ? "내보내는 중…" : "내보내기"}
          </button>
          <button type="button" className="btn btn--ghost" style={{ height: 50 }} disabled={busy} onClick={() => setKick(null)}>
            취소
          </button>
        </Sheet>
      ) : null}

      {sheet === "leave" ? (
        <Sheet
          open
          onClose={() => {
            setSheet(null);
            setLeaveError("");
          }}
          title={iAmOwner ? "팀을 지우고 나갈까요?" : "팀에서 나갈까요?"}
          sub={
            iAmOwner
              ? "혼자 있는 팀이라 나가면 팀이 지워져요. 대화 · 사진 · 자료 · 할 일이 모두 사라지고 되돌릴 수 없어요."
              : "나가면 이 팀의 대화와 자료를 볼 수 없어요. 다시 들어오려면 초대 링크가 필요해요."
          }
        >
          <button
            type="button"
            className="btn btn--danger"
            style={{ height: 50 }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setLeaveError("");
              try {
                await leaveTeam(team.id);
                router.replace("/home");
              } catch (e) {
                setBusy(false);
                setLeaveError(e instanceof Error ? e.message : "팀에서 나가지 못했어요");
              }
            }}
          >
            {busy ? "나가는 중…" : iAmOwner ? "팀 지우고 나가기" : "팀 나가기"}
          </button>
          {leaveError ? (
            <span role="alert" className="t-13 t-warn" style={{ lineHeight: 1.5 }}>
              {leaveError}
            </span>
          ) : null}
          <button type="button" className="btn btn--ghost" style={{ height: 50 }} onClick={() => setSheet(null)}>
            취소
          </button>
        </Sheet>
      ) : null}
    </main>
  );
}

function NameSheet({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  const v = value.trim();
  return (
    <Sheet open onClose={onClose} title="팀 이름 바꾸기" sub="팀원 모두에게 바뀐 이름으로 보여요">
      <input
        className="input"
        type="text"
        autoFocus
        maxLength={40}
        aria-label="팀 이름"
        placeholder="팀명을 입력해주세요"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v && v !== initial) onSave(v);
        }}
      />
      <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={!v || v === initial} onClick={() => onSave(v)}>
        저장
      </button>
    </Sheet>
  );
}
