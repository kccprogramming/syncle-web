/**
 * Supabase 연결 (A · 현서) — 브라우저에서만 불러요.
 * (data.ts가 서버 코드에서도 쓰여서 "use client"를 붙이지 않고, React 훅은 use-auth-user.ts에 따로 뒀어요.)
 *
 * .env.local의 NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY로 접속해요.
 * 둘 중 하나라도 없으면 null을 돌려주고, 화면은 지금처럼 가짜 데이터 데모로 움직여요.
 * 비밀 키(SUPABASE_SERVICE_ROLE_KEY)는 여기서 절대 쓰지 않아요 (서버 전용).
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createBrowserClient(url, key) : null;
  return client;
}

/**
 * Google로 로그인 — Google 화면에 갔다가 /auth/callback으로 돌아와요.
 * next: 로그인 뒤 갈 화면 (예: 초대 링크로 왔으면 /join?code=…)
 * Supabase 대시보드 Authentication → URL Configuration → Redirect URLs에
 * 이 앱 주소(http://localhost:3000/**, Vercel 주소)가 있어야 돌아올 수 있어요.
 */
export async function signInWithGoogle(next?: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return "로그인 설정(Supabase 키)이 없어요";
  const back = new URL("/auth/callback", window.location.origin);
  if (next) back.searchParams.set("next", next);
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back.toString() } });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
}
