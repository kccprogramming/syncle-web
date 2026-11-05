"use client";

/** 0-1 로그인 — 처음 로그인한 사용자는 빈 홈(1-0)으로 가요. */
import { LogoMark } from "@/components/Logo";
import { LoginButtons } from "@/components/home/LoginButtons";

export default function LoginPage() {
  return (
    <main className="screen screen--white" style={{ padding: "0 24px 32px" }}>
      <div className="stack gap-16 grow" style={{ alignItems: "center", justifyContent: "center" }}>
        <LogoMark size={72} label="싱클 로고" />
        <div className="stack gap-8" style={{ alignItems: "center" }}>
          <h1 style={{ fontFamily: "var(--font-brand)", fontSize: 34, fontWeight: 700, letterSpacing: -0.3 }}>Syncle</h1>
          <p className="t-15 t-ink2">우리 팀의 대화가 일정이 되는 곳</p>
        </div>
      </div>
      <LoginButtons href="/home?empty=1" />
    </main>
  );
}
