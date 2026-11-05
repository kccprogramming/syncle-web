"use client";

/**
 * 2-1 초대 링크로 참여하기.
 * ?code=7K2Q-HCI4 처럼 들어오면 코드 칸에 채워 두고, 없으면 예시 코드를 넣어 둬요.
 * 들어오는 사람이 '주로 출발하는 곳'을 직접 골라요 → 6 장소 추천(D)의 이동시간 계산에 써요.
 * 데모에서는 서연님이 들어오는 장면이에요 (JOINING_MEMBER_ID).
 */
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { OriginPickerSheet } from "@/components/home/OriginPickerSheet";
import { useDemo } from "@/lib/demo-store";
import { TopBar } from "@/components/TopBar";
import { AvatarStack, TeamBadge } from "@/components/Avatar";
import { Toast, useToast } from "@/components/Toast";
import { getInvite, getMembers, getTeams, saveMyOrigin } from "@/lib/data";

const DEFAULT_CODE = "7K2Q-HCI4";
// 데모에서 팀에 들어오는 사람 (실제로는 로그인한 계정)
const JOINING_MEMBER_ID = "u-seoyeon";

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

/** 붙여넣은 값이 링크여도 맨 끝 코드만 꺼내요: https://syncle.app/invite/7K2Q-HCI4 → 7K2Q-HCI4 */
function toCode(value: string) {
  return value.trim().split("/").filter(Boolean).pop() ?? "";
}

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { state, update } = useDemo();
  const [value, setValue] = useState(sp.get("code") || DEFAULT_CODE);
  const [nick, setNick] = useState("서연");
  const [origin, setOrigin] = useState(state.memberOrigins[JOINING_MEMBER_ID] ?? null);
  const [originOpen, setOriginOpen] = useState(false);

  const code = toCode(value);
  const found = getTeams().some((t) => t.inviteCode.toUpperCase() === code.toUpperCase());
  const invite = getInvite(code.toUpperCase());
  const { team } = invite;
  const members = getMembers(team.memberIds).filter((m) => invite.memberNames.includes(m.name));

  async function join() {
    if (origin) {
      update((s) => ({ memberOrigins: { ...s.memberOrigins, [JOINING_MEMBER_ID]: origin } }));
      await saveMyOrigin(JOINING_MEMBER_ID, origin);
    }
    router.push(`/teams/${team.id}`);
  }

  async function paste() {
    try {
      setValue(await navigator.clipboard.readText());
    } catch {
      toast.show("붙여넣기를 할 수 없어요. 직접 입력해 주세요");
    }
  }

  return (
    <main className="screen screen--white">
      <TopBar back="/home" backLabel="홈으로" plain />

      <div className="screen__body" style={{ padding: "8px 20px 20px", gap: 20 }}>
        <div className="stack gap-8">
          <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.35 }}>초대받은 팀에 참여하기</h1>
          <p className="t-14 t-ink2" style={{ lineHeight: 1.6 }}>팀원에게 받은 초대 링크나 초대 코드를 붙여넣어 주세요.</p>
        </div>

        <div className="field">
          <label htmlFor="invite" className="field__label">초대 링크 또는 코드</label>
          <div className="hstack gap-8">
            <input
              id="invite"
              className="input grow"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ border: `1.5px solid ${found ? "var(--accent)" : "var(--line-strong)"}`, letterSpacing: 0.5 }}
            />
            <button type="button" className="btn btn--ghost no-shrink" style={{ fontSize: 14, padding: "0 14px" }} onClick={paste}>
              붙여넣기
            </button>
          </div>
          {found ? (
            <span className="t-12 t-ok">팀을 찾았어요</span>
          ) : (
            <span className="t-12 t-warn">초대 코드를 다시 확인해 주세요</span>
          )}
        </div>

        {found && (
          <section
            aria-label="참여할 팀"
            className="stack gap-12 no-shrink"
            style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-l)", padding: 16 }}
          >
            <div className="hstack gap-12">
              <TeamBadge initial={team.initial} color={team.color} ink={team.ink} size={48} />
              <div className="stack gap-2">
                <span className="t-strong" style={{ fontSize: 16 }}>{team.name}</span>
                <span className="t-13 t-muted">{invite.inviterName}님이 초대했어요</span>
              </div>
            </div>
            <div className="hstack gap-10">
              <AvatarStack members={members} size={28} />
              <span className="t-13 t-ink2">
                {invite.memberNames.join(", ")} · {invite.memberNames.length}명 참여 중
              </span>
            </div>
            {team.aiEnabled && (
              <p className="t-12 t-ink2" style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: 10, lineHeight: 1.55 }}>
                이 팀은 AI 회의 도우미가 켜져 있어요. AI는 이 팀 대화방의 메시지만 읽고, 개인 메시지는 읽지 않아요.
              </p>
            )}
          </section>
        )}

        <div className="field">
          <label htmlFor="nick" className="field__label">팀에서 쓸 이름</label>
          <input id="nick" className="input" type="text" value={nick} onChange={(e) => setNick(e.target.value)} />
        </div>

        <div className="field">
          <span className="field__label">주로 출발하는 곳</span>
          <button
            type="button"
            aria-label={`주로 출발하는 곳 ${origin ? `${origin.name}, ${origin.roadAddress}. 바꾸기` : "찾기"}`}
            onClick={() => setOriginOpen(true)}
            className="input hstack gap-10"
            style={{ height: "auto", minHeight: 56, padding: "8px 14px", textAlign: "left" }}
          >
            <span style={{ color: "var(--accent)", display: "inline-flex", flexShrink: 0 }}>
              <Icon name="pin" size={20} />
            </span>
            {origin ? (
              <span className="stack gap-2" style={{ flex: "1 1 auto", minWidth: 0 }}>
                <span className="t-15 t-strong t-ellipsis">{origin.name}</span>
                <span className="t-12 t-muted t-ellipsis">{origin.roadAddress}</span>
              </span>
            ) : (
              <span className="t-15 t-muted" style={{ flex: "1 1 auto" }}>역이나 건물 이름으로 찾기</span>
            )}
            <span className="t-13 t-accent t-strong" style={{ flexShrink: 0 }}>{origin ? "변경" : "찾기"}</span>
          </button>
          <span className="field__hint">
            {origin ? `팀원에게는 ‘${origin.area}’까지만 보여요` : "회의 장소를 정할 때 이동시간 계산에 써요 · 팀원에게는 동네까지만 보여요"} · 나중에 바꿀 수 있어요
          </span>
        </div>
      </div>

      <footer className="footer footer--bare" style={{ padding: "12px 20px 24px" }}>
        {found ? (
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={join}>
            팀 참여하기
          </button>
        ) : (
          <button type="button" className="btn btn--lg btn--block" disabled>
            팀 참여하기
          </button>
        )}
      </footer>

      <Toast {...toast} />

      {originOpen ? (
        <OriginPickerSheet
          initial={origin}
          onClose={() => setOriginOpen(false)}
          onPick={(place) => {
            setOrigin(place);
            setOriginOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
