"use client";

/** 1-1 내 정보 — 출발지, 매주 안 되는 시간, 알림 설정, 로그아웃. */
import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Avatar } from "@/components/Avatar";
import { Switch } from "@/components/Controls";
import { Toast, useToast } from "@/components/Toast";
import { WeeklyBlockSheet, formatBlock } from "@/components/home/WeeklyBlockSheet";
import { OriginPickerSheet } from "@/components/home/OriginPickerSheet";
import { Icon } from "@/components/Icon";
import { useDemo } from "@/lib/demo-store";
import { getMe, getTeams, saveMyOrigin } from "@/lib/data";

export default function MePage() {
  const me = getMe();
  const teamCount = getTeams().length;
  const { state, update } = useDemo();
  const toast = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [originOpen, setOriginOpen] = useState(false);
  const origin = state.origin;
  // TODO: API 연결 시 알림 설정도 서버에 저장하기
  const [notiOn, setNotiOn] = useState(me.notificationsOn);

  const soon = () => toast.show("준비 중이에요");

  return (
    <main className="screen">
      <TopBar back="/home" backLabel="홈으로" title="내 정보" />

      <div className="screen__body">
        {/* 프로필 */}
        <section className="card hstack" style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14 }}>
          <Avatar member={me} size={56} />
          <div className="stack gap-2 grow">
            <span style={{ fontSize: 17, fontWeight: 700 }}>{me.name}</span>
            <span className="t-12 t-muted">
              Google 계정으로 로그인 · 팀 {teamCount}개
            </span>
          </div>
          <button type="button" className="btn btn--sm btn--ghost no-shrink" style={{ fontSize: 12 }} onClick={soon}>
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
                  <span className="t-13 t-ink2 t-ellipsis">{origin.roadAddress}</span>
                  <span className="t-12 t-muted">팀원에게는 ‘{origin.area}’까지만 보여요</span>
                </>
              ) : null}
            </span>
            <span className="t-13 t-accent no-shrink">수정 ›</span>
          </button>
          <div className="divider" style={{ margin: "0 16px" }} />
          <div className="stack gap-8" style={{ padding: "12px 16px 16px" }}>
            <span className="t-13 t-muted">매주 안 되는 시간</span>
            <div className="hstack gap-8" style={{ flexWrap: "wrap" }}>
              {state.weeklyBlocks.map((b) => (
                <span key={b.id} className="chip chip--soft" style={{ padding: "0 12px" }}>
                  {formatBlock(b)}
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
                toast.show(next ? "알림을 켰어요" : "알림을 껐어요");
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
          <Link href="/login" className="t-14 t-ink2" style={{ padding: "12px 14px" }}>
            로그아웃
          </Link>
          <span className="t-14" style={{ padding: "12px 0", color: "var(--line-strong)" }}>|</span>
          <button type="button" className="t-14 t-muted" style={{ padding: "12px 14px", border: 0, background: "none" }} onClick={soon}>
            회원 탈퇴
          </button>
        </div>
      </div>

      {originOpen && (
        <OriginPickerSheet
          initial={origin}
          onClose={() => setOriginOpen(false)}
          onPick={(place) => {
            update({ origin: place });
            void saveMyOrigin(me.id, place);
            setOriginOpen(false);
            toast.show("출발하는 곳을 바꿨어요");
          }}
        />
      )}
      {sheetOpen && (
        <WeeklyBlockSheet
          onClose={() => setSheetOpen(false)}
          onAdd={(block) => {
            update((s) => ({ weeklyBlocks: [...s.weeklyBlocks, block] }));
            setSheetOpen(false);
            toast.show("매주 안 되는 시간을 추가했어요");
          }}
        />
      )}
      <Toast {...toast} />
    </main>
  );
}
