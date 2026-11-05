"use client";

/**
 * Google 로그인에서 돌아오는 곳 (A · Supabase).
 *
 * Supabase가 주소의 ?code=…를 로그인 상태로 바꿔 줘요. 그다음 갈 화면을 골라요:
 * - next가 있으면 그 화면 (예: 초대 링크 → /join?code=…)
 * - 없으면 내 팀이 있으면 홈(1), 없으면 처음 로그인한 홈(1-0)
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { getSupabase } from "@/lib/supabase";

/** 우리 앱 안의 주소만 받아요 (다른 사이트로 보내는 주소는 무시) */
function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function Callback() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(sp.get("error_description"));

  useEffect(() => {
    if (error) return;
    const supabase = getSupabase();
    if (!supabase) {
      setError("로그인 설정(Supabase 키)이 없어요");
      return;
    }
    let cancelled = false;
    (async () => {
      // 브라우저용 Supabase가 처음 열릴 때 주소의 code를 로그인 상태로 바꿔요. 끝날 때까지 기다려요.
      const { data, error: e } = await supabase.auth.getSession();
      if (cancelled) return;
      if (e || !data.session) {
        setError(e?.message ?? "로그인 정보를 받지 못했어요");
        return;
      }
      const next = safeNext(sp.get("next"));
      if (next) return router.replace(next);
      const { count } = await supabase
        .from("team_members")
        .select("team_id", { count: "exact", head: true })
        .eq("member_id", data.session.user.id);
      if (!cancelled) router.replace(count ? "/home" : "/home?empty=1");
    })();
    return () => {
      cancelled = true;
    };
  }, [error, router, sp]);

  return (
    <main className="screen screen--white" style={{ padding: "0 24px 32px" }}>
      <div className="stack gap-16 grow" style={{ alignItems: "center", justifyContent: "center" }}>
        <LogoMark size={56} label="싱클 로고" />
        {error ? (
          <div className="stack gap-8" style={{ alignItems: "center" }}>
            <p className="t-15">로그인하지 못했어요</p>
            <p className="t-13 t-muted t-center">{error}</p>
            <Link href="/login" className="t-13" style={{ textDecoration: "underline" }}>
              다시 로그인하기
            </Link>
          </div>
        ) : (
          <p className="t-15 t-ink2">로그인하는 중…</p>
        )}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
