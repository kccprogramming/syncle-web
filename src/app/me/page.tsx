"use client";

/** 1-1 내 정보 — 이름, 출발지, 매주 안 되는 시간, 알림 설정, 로그아웃. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Avatar } from "@/components/Avatar";
import { Switch } from "@/components/Controls";
import { Toast, useToast } from "@/components/Toast";
import { WeeklyBlockSheet, formatBlock } from "@/components/home/WeeklyBlockSheet";
import { OriginPickerSheet } from "@/components/home/OriginPickerSheet";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { useDemo } from "@/lib/demo-store";
import { getMe, getTeams, loadMyProfile, loadMyTeams, originForD, saveMyNickname, saveMyNotifications, saveMyOrigin, saveMyWeekly, type MyProfile } from "@/lib/data";
import type { Team } from "@/types";
import { signOut } from "@/lib/supabase";
import { useAuthUser } from "@/lib/use-auth-user";

export default function MePage() {
  const me = getMe();
  const { state, update } = useDemo();
  const toast = useToast();
  const router = useRouter();
  // 실제 Google 로그인(A)을 했으면 그 계정을 보여줘요. 아니면 가짜 데이터의 '나'
  const user = useAuthUser();
  // 로그인했으면 Supabase에 저장된 내 정보(A)를, 아니면 데모 값을 보여줘요
  const [profile, setProfile] = useState<MyProfile | null>(null);
  // 내 진짜 팀 (팀 수)
  const [myTeams, setMyTeams] = useState<Team[] | null>(null);
  // 확인 중(undefined)일 때도 데모 값을 잠깐 보여주지 않게 live로 둬요
  const live = user !== null;
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setMyTeams(null);
      return;
    }
    loadMyProfile()
      .then((p) => {
        setProfile(p);
        if (p) setNotiOn(p.notificationsOn);
      })
      .catch(() => toast.show("내 정보를 불러오지 못했어요"));
    loadMyTeams()
      .then(setMyTeams)
      .catch(() => setMyTeams(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 이름: 팀원에게 보이는 이름(profiles.nickname) → 없으면 Google 이름 → 데모
  const googleName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const name = live ? profile?.nickname || googleName || "이름 없음" : me.name;
  const teamCount = live ? (myTeams?.length ?? 0) : getTeams().length;

  // 화면에 보일 출발지 · 매주 안 되는 시간
  const origin = live
    ? profile?.origin
      ? { name: profile.origin, roadAddress: "", area: profile.area ?? "" }
      : null
    : state.origin;
  const weeklyLines = live ? (profile?.weekly ?? []) : state.weeklyBlocks.map(formatBlock);

  async function saveOrFail(job: Promise<void>, done: string) {
    try {
      await job;
      toast.show(done);
    } catch {
      toast.show("저장하지 못했어요 · 잠시 후 다시 해 주세요");
    }
  }

  async function logout() {
    await signOut();
    router.push("/login");
  }

  const [sheetOpen, setSheetOpen] = useState(false);
  const [originOpen, setOriginOpen] = useState(false);
  const [notiOn, setNotiOn] = useState(me.notificationsOn);
  const [nameOpen, setNameOpen] = useState(false);

  const soon = () => toast.show("준비 중이에요");

  return (
    <main className="screen">
      <TopBar back="/home" backLabel="홈으로" title="내 정보" />

      <div className="screen__body">
        {/* 프로필 */}
        <section className="card hstack" style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14 }}>
          <Avatar member={{ ...me, initial: Array.from(name)[0] ?? me.initial }} size={56} />
          <div className="stack gap-2 grow" style={{ minWidth: 0 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{name}</span>
            <span className="t-12 t-muted t-ellipsis">
              {user?.email ? `${user.email} · ` : "Google 계정으로 로그인 · "}팀 {teamCount}개
            </span>
          </div>
          <button type="button" className="btn btn--sm btn--ghost no-shrink" style={{ fontSize: 12 }} onClick={() => (live ? setNameOpen(true) : soon())}>
            이름 수정
          </button>
        </section>

        {/* 회의 정보 */}
        <section className="card card--flush">
          <div className="stack gap-2" style={{ padding: "14px 16px 4px" }}>
            <h2 className="t-15 t-strong">회의 정보</h2>
            <span className="t-12 t-muted">AI가 시간과 장소를 정할 때 써요</span>
          </div>
          <button
            type="button"
            className="row"
            style={{ minHeight: 56, padding: "12px 16px", alignItems: "center" }}
            onClick={() => setOriginOpen(true)}
            aria-label={`주로 출발하는 곳 ${origin ? `${origin.name}, ${origin.roadAddress}` : "없음"}. 수정`}
          >
            <span className="stack gap-2 grow" style={{ minWidth: 0 }}>
              <span className="t-13 t-muted">주로 출발하는 곳</span>
              <span className="hstack gap-4" style={{ minWidth: 0 }}>
                <span style={{ color: "var(--accent)", display: "inline-flex", flexShrink: 0 }}>
                  <Icon name="pin" size={16} />
                </span>
                <span className="t-15 t-strong t-ellipsis">{origin ? origin.name : "아직 정하지 않았어요"}</span>
              </span>
              {origin ? (
                <>
                  {origin.roadAddress ? <span className="t-13 t-ink2 t-ellipsis">{origin.roadAddress}</span> : null}
                  {origin.area ? <span className="t-12 t-muted">팀원에게는 ‘{origin.area}’까지만 보여요</span> : null}
                </>
              ) : null}
            </span>
            <span className="t-13 t-accent no-shrink">수정 ›</span>
          </button>
          <div className="divider" style={{ margin: "0 16px" }} />
          <div className="stack gap-8" style={{ padding: "12px 16px 16px" }}>
            <span className="t-13 t-muted">매주 안 되는 시간</span>
            <div className="hstack gap-8" style={{ flexWrap: "wrap" }}>
              {weeklyLines.map((line, i) => (
                <span key={`${i}-${line}`} className="chip chip--soft" style={{ padding: "0 12px" }}>
                  {line}
                </span>
              ))}
              <button type="button" className="chip chip--dashed" onClick={() => setSheetOpen(true)}>
                + 추가
              </button>
            </div>
          </div>
        </section>

        {/* 설정 */}
        <section className="card card--flush">
          <div className="row">
            <span className="t-14 grow">알림</span>
            <Switch
              on={notiOn}
              label="알림"
              onChange={(next) => {
                setNotiOn(next);
                void saveOrFail(saveMyNotifications(next), next ? "알림을 켰어요" : "알림을 껐어요");
              }}
            />
          </div>
          <div className="divider" style={{ margin: "0 16px" }} />
          <button type="button" className="row" onClick={soon}>
            <span className="stack grow" style={{ gap: 1 }}>
              <span className="t-14">AI가 읽는 범위</span>
              <span className="t-12 t-muted">AI 도우미가 켜진 팀 대화방만 읽어요</span>
            </span>
            <span style={{ fontSize: 16, color: "var(--disabled)" }}>›</span>
          </button>
          <div className="divider" style={{ margin: "0 16px" }} />
          <button type="button" className="row" onClick={soon}>
            <span className="t-14 grow">이용약관 · 개인정보처리방침</span>
            <span style={{ fontSize: 16, color: "var(--disabled)" }}>›</span>
          </button>
        </section>

        <div className="hstack gap-4" style={{ justifyContent: "center", marginTop: 4 }}>
          <button type="button" className="t-14 t-ink2" style={{ padding: "12px 14px", border: 0, background: "none" }} onClick={() => void logout()}>
            로그아웃
          </button>
        </div>
      </div>

      {originOpen && (
        <OriginPickerSheet
          initial={live ? null : state.origin}
          onClose={() => setOriginOpen(false)}
          onPick={(place) => {
            update({ origin: place });
            setOriginOpen(false);
            if (live) setProfile((p) => (p ? { ...p, origin: originForD(place), area: place.area } : p));
            void saveOrFail(saveMyOrigin(me.id, place), "출발하는 곳을 바꿨어요");
          }}
        />
      )}
      {sheetOpen && (
        <WeeklyBlockSheet
          onClose={() => setSheetOpen(false)}
          onAdd={(block) => {
            update((s) => ({ weeklyBlocks: [...s.weeklyBlocks, block] }));
            setSheetOpen(false);
            if (live && profile) {
              const lines = [...profile.weekly, formatBlock(block)];
              setProfile({ ...profile, weekly: lines });
              void saveOrFail(saveMyWeekly(lines), "매주 안 되는 시간을 추가했어요");
            } else toast.show("매주 안 되는 시간을 추가했어요");
          }}
        />
      )}
      {nameOpen && (
        <NameSheet
          initial={profile?.nickname || googleName}
          onClose={() => setNameOpen(false)}
          onSave={(next) => {
            setNameOpen(false);
            const prev = profile;
            setProfile((p) => (p ? { ...p, nickname: next } : p));
            saveMyNickname(next)
              .then(() => toast.show("이름을 바꿨어요"))
              .catch(() => {
                setProfile(prev);
                toast.show("저장하지 못했어요 · 잠시 후 다시 해 주세요");
              });
          }}
        />
      )}
      <Toast {...toast} />
    </main>
  );
}

function NameSheet({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [value, setValue] = useState(initial);
  const v = value.trim();
  const ok = v.length > 0 && v !== initial;
  return (
    <Sheet open onClose={onClose} title="이름 바꾸기" sub="팀원 모두에게 바뀐 이름으로 보여요">
      <input
        className="input"
        type="text"
        autoFocus
        maxLength={20}
        aria-label="이름"
        placeholder="팀원에게 보일 이름"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && ok) onSave(v);
        }}
      />
      <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={!ok} onClick={() => onSave(v)}>
        저장
      </button>
    </Sheet>
  );
}
