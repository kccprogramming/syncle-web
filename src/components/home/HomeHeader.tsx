"use client";

/** 홈 맨 위: 로고 + 알림(🔔) + 내 프로필. 빈 홈에서는 알림 버튼을 숨겨요. */
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LogoMark, Wordmark } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { getMe } from "@/lib/data";

export function HomeHeader({ unreadCount }: { unreadCount?: number }) {
  const me = getMe();
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
