"use client";

/**
 * 로그인 버튼 묶음 (카카오 / Google) + 약관 안내 문구.
 * 0-1 로그인, 0-2 초대 로그인에서 같이 써요. 두 버튼 모두 href로 이동해요.
 */
import Link from "next/link";
import { Toast, useToast } from "@/components/Toast";

export function LoginButtons({ href }: { href: string }) {
  const toast = useToast();

  return (
    <div className="stack gap-10">
      <Link
        href={href}
        className="btn btn--lg btn--block"
        style={{ background: "var(--kakao)", color: "var(--kakao-ink)" }}
      >
        카카오로 시작하기
      </Link>
      <GoogleButton href={href} />
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
function GoogleButton({ href }: { href: string }) {
  return (
    <>
      {/* Google Sans 글꼴은 layout.tsx의 Google Fonts 링크에 추가해야 보여요 (없으면 기본 글꼴) */}
      <Link
        href={href}
        style={{
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
        Google로 계속하기
      </Link>
    </>
  );
}
