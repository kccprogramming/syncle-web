"use client";

/** 0 스플래시 — 잠깐 보여준 뒤 로그인으로 넘어가요. 누르면 바로 넘어가요. */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push("/login"), 1800);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main
      className="screen"
      style={{ background: "var(--accent)", color: "#fff", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      onClick={() => router.push("/login")}
    >
      <div className="stack gap-16" style={{ alignItems: "center" }}>
        <LogoMark size={96} inverted label="싱클 로고" />
        <div className="stack gap-4" style={{ alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-brand)", fontSize: 40, fontWeight: 700, letterSpacing: -0.5 }}>Syncle</span>
          <span style={{ fontSize: 15, opacity: 0.85 }}>싱클</span>
        </div>
        <p style={{ fontSize: 16, opacity: 0.95, marginTop: 8 }}>우리 팀의 대화가 일정이 되는 곳</p>
      </div>
    </main>
  );
}
