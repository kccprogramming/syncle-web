"use client";

/**
 * 1-2 알림 — '오늘' / '이전'으로 묶어 보여주고, '모두 읽음'을 누르면 굵은 글씨·파란 점이 사라져요.
 * 로그인했으면 내 진짜 알림(A · app_notifications): 할 일 배정, 회의 응답 다시 알림 …
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { useDemo } from "@/lib/demo-store";
import { getNotifications, loadMyNotifications, markNotificationsRead } from "@/lib/data";
import { useAuthUser } from "@/lib/use-auth-user";
import type { AppNotification } from "@/types";

// 알림 종류별 동그라미 아이콘 (글자, 배경색, 글자색)
const KIND_ICON: Record<AppNotification["kind"], { text: string; bg: string; ink: string }> = {
  due: { text: "!", bg: "var(--warn-bg)", ink: "var(--warn)" },
  ai: { text: "AI", bg: "var(--accent)", ink: "#fff" },
  file: { text: "자료", bg: "var(--accent-soft)", ink: "var(--accent-strong)" },
  task: { text: "✓", bg: "var(--ok-bg)", ink: "var(--ok)" },
  done: { text: "✓", bg: "var(--line-2)", ink: "var(--ink-2)" },
};

const GROUPS: { key: AppNotification["group"]; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "before", label: "이전" },
];

export default function NotificationsPage() {
  const { state, update } = useDemo();
  const user = useAuthUser();
  // 로그인했으면 진짜 알림. undefined = 불러오는 중
  const [live, setLive] = useState<AppNotification[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!user) return;
    loadMyNotifications()
      .then((list) => setLive(list ?? []))
      .catch(() => {
        setFailed(true);
        setLive([]);
      });
  }, [user]);
  const isLive = !!user;
  const all = isLive ? (live ?? []) : getNotifications();
  const readAll = () => {
    if (!isLive) return update({ notificationsRead: true });
    setLive((prev) => prev?.map((n) => ({ ...n, unread: false })));
    void markNotificationsRead().catch(() => undefined);
  };
  const readOne = (id: string) => {
    if (!isLive) return;
    setLive((prev) => prev?.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    void markNotificationsRead(id).catch(() => undefined);
  };

  return (
    <main className="screen">
      <TopBar
        back="/home"
        backLabel="홈으로"
        title="알림"
        right={
          <button
            type="button"
            className="t-13 t-accent"
            style={{ height: 40, padding: "0 10px", border: 0, background: "none" }}
            onClick={readAll}
          >
            모두 읽음
          </button>
        }
      />

      <div className="screen__body" style={{ padding: "12px 16px", gap: 10 }}>
        {isLive && live === undefined ? <p className="t-13 t-muted">불러오는 중…</p> : null}
        {failed ? <p className="t-13 t-warn">알림을 불러오지 못했어요 · 새로고침해 주세요</p> : null}
        {isLive && live && live.length === 0 && !failed ? (
          <div className="stack gap-6 t-center" style={{ alignItems: "center", margin: "40px 0" }}>
            <span className="t-15 t-strong">아직 알림이 없어요</span>
            <span className="t-13 t-muted" style={{ lineHeight: 1.5 }}>할 일이 나에게 오거나 회의 응답을 부탁받으면 여기에 와요</span>
          </div>
        ) : null}
        {GROUPS.map((g) => {
          const items = all.filter((n) => n.group === g.key);
          if (items.length === 0) return null;
          return (
            <section key={g.key} className="stack gap-10">
              <h2 className="section-label" style={{ marginTop: 4 }}>{g.label}</h2>
              <div className="card card--flush" style={{ overflow: "hidden" }}>
                {items.map((n) => (
                  <NoticeRow key={n.id} n={n} unread={n.unread && (isLive || !state.notificationsRead)} onOpen={() => readOne(n.id)} />
                ))}
              </div>
            </section>
          );
        })}
        <Link href="/me" className="t-12 t-muted t-center" style={{ marginTop: 4 }}>
          알림은 내 정보에서 끌 수 있어요
        </Link>
      </div>
    </main>
  );
}

function NoticeRow({ n, unread, onOpen }: { n: AppNotification; unread: boolean; onOpen?: () => void }) {
  const icon = KIND_ICON[n.kind];
  return (
    <Link
      href={n.href}
      onClick={onOpen}
      className="hstack gap-12"
      style={{
        padding: "12px 14px",
        alignItems: "flex-start",
        color: "var(--ink)",
        background: unread ? "var(--accent-softer)" : "var(--surface)",
        borderBottom: "1px solid var(--line-2)",
      }}
    >
      <span
        className="hstack no-shrink"
        style={{ width: 36, height: 36, borderRadius: 18, background: icon.bg, color: icon.ink, fontSize: 13, fontWeight: 700, justifyContent: "center" }}
      >
        {icon.text}
      </span>
      <span className="stack gap-2 grow">
        <span className="t-12 t-muted">
          {n.teamName} · {n.time}
        </span>
        <span className="t-14" style={{ lineHeight: 1.45, fontWeight: unread ? 600 : 400 }}>
          {n.text}
        </span>
      </span>
      <span
        aria-label={unread ? "안 읽음" : undefined}
        className="no-shrink"
        style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, background: unread ? "var(--accent)" : "transparent" }}
      />
    </Link>
  );
}
