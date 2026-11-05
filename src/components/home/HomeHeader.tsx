"use client";

/** 홈 맨 위: 로고 + 알림(🔔) + 내 프로필. 빈 홈에서는 알림 버튼을 숨겨요. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { LogoMark, Wordmark } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { getMe, loadTeamMembers } from "@/lib/data";
import { useAuthUser } from "@/lib/use-auth-user";
import type { Member } from "@/types";

export function HomeHeader({ unreadCount }: { unreadCount?: number }) {
  const demo = getMe();
  // 로그인했으면 내 이름 첫 글자 (내 정보와 같은 규칙: 팀원에게 보이는 이름 → 없으면 Google 이름)
  const user = useAuthUser();
  const [mine, setMine] = useState<Member | null>(null);
  useEffect(() => {
    if (!user) return setMine(null);
    const google = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "").trim();
    const fallback = (name: string): Member => ({ ...demo, id: user.id, name, initial: Array.from(name)[0] ?? "?" });
    setMine(fallback(google || "나"));
    loadTeamMembers([user.id])
      .then(([m]) => {
        const name = m && m.name !== "팀원" ? m.name : google;
        if (name) setMine({ ...(m ?? fallback(name)), name, initial: Array.from(name)[0] ?? "?" });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  // 로그인 확인 중에는 데모 이름(민지)을 잠깐 보여주지 않아요
  const me = user === undefined ? { ...demo, initial: "" } : (mine ?? demo);
  const showBell = unreadCount !== undefined;

  return (
    <header
      className="hstack gap-4 no-shrink"
      style={{ height: 64, padding: "0 12px 0 20px", background: "var(--surface)" }}
    >
      <div className="hstack gap-8 grow">
        <LogoMark size={30} />
        <h1 style={{ lineHeight: 1 }}>
          <Wordmark size={24} />
        </h1>
      </div>
      {showBell && (
        <Link
          href="/notifications"
          className="icon-btn"
          aria-label={unreadCount > 0 ? `알림, 새 알림 ${unreadCount}개` : "알림"}
          style={{ color: "var(--ink)" }}
        >
          {unreadCount > 0 && <span className="dot-badge" />}
          <Icon name="bell" size={22} strokeWidth={1.8} />
        </Link>
      )}
      <Link href="/me" className="icon-btn" aria-label="내 정보">
        <Avatar member={me} size={32} />
      </Link>
    </header>
  );
}
