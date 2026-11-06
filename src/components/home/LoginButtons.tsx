"use client";

/**
 * 로그인 버튼 (Google) + 약관 안내 문구.
 * 0-1 로그인, 0-2 초대 로그인에서 같이 써요.
 * Supabase 키가 있으면 실제 Google 로그인(A)을 하고, 로그인 뒤 /auth/callback을 거쳐 화면을 골라요.
 * 키가 없으면 지금처럼 href로 바로 이동하는 데모예요.
 * next: 실제 로그인 뒤 갈 화면. 비우면 팀이 있으면 홈(1), 없으면 처음 홈(1-0)으로 가요.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Toast, useToast } from "@/components/Toast";
import { getSupabase, signInWithGoogle } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo-scheduling";

export function LoginButtons({ href, next }: { href: string; next?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // 발표 데모(/demo로 들어옴)면 실제 Google 로그인 없이 데모 흐름으로 넘어가요
  const [demo, setDemo] = useState(false);
  useEffect(() => setDemo(isDemoMode()), []);

  async function onGoogle(e: React.MouseEvent) {
    if (!getSupabase() || isDemoMode()) return; // 키가 없거나 데모면 Link가 그대로 데모 화면으로 이동해요
    e.preventDefault();
    setBusy(true);
    const error = await signInWithGoogle(next);
    if (error) {
      setBusy(false);
      toast.show(`로그인하지 못했어요 · ${error}`);
    }
    // 성공하면 브라우저가 Google 화면으로 넘어가요
  }

  return (
    <div className="stack gap-10">
      <GoogleButton href={href} onClick={onGoogle} busy={busy} />
      {demo ? <p className="t-12 t-accent t-center" style={{ margin: 0 }}>데모예요 · 실제로 로그인하지 않고 예시 계정으로 들어가요</p> : null}
      <p className="t-12 t-muted t-center" style={{ marginTop: 6, lineHeight: 1.6 }}>
        시작하면{" "}
        <button type="button" style={linkStyle} onClick={() => toast.show("준비 중이에요")}>
          이용약관
        </button>
        과{" "}
        <button type="button" style={linkStyle} onClick={() => toast.show("준비 중이에요")}>
          개인정보처리방침
        </button>
        에 동의하게 돼요.
        <br />
        AI는 내가 참여한 팀 대화방 메시지만 읽어요.
      </p>
      <Toast {...toast} />
    </div>
  );
}

// 글 사이에 들어가는 밑줄 링크 모양 버튼
const linkStyle: React.CSSProperties = {
  border: 0,
  background: "none",
  padding: 0,
  font: "inherit",
  color: "var(--ink-2)",
  textDecoration: "underline",
};

/**
 * Google 로그인 버튼. Google 브랜드 가이드(공식 G 로고, 흰 바탕, #747775 테두리)를 지켜야 해서
 * 색을 토큰이 아닌 값 그대로 써요.
 */
function GoogleButton({ href, onClick, busy }: { href: string; onClick: (e: React.MouseEvent) => void; busy: boolean }) {
  return (
    <>
      {/* Google Sans 글꼴은 layout.tsx의 Google Fonts 링크에 추가해야 보여요 (없으면 기본 글꼴) */}
      <Link
        href={href}
        onClick={onClick}
        aria-busy={busy}
        style={{
          opacity: busy ? 0.6 : 1,
          height: 52,
          borderRadius: 12,
          border: "1px solid #747775",
          background: "#FFFFFF",
          color: "#1F1F1F",
          fontFamily: "'Google Sans', var(--font)",
          fontSize: 14,
          lineHeight: "20px",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 12px",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block", flexShrink: 0, marginRight: 10 }}>
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {busy ? "Google로 이동하는 중…" : "Google로 계속하기"}
      </Link>
    </>
  );
}
