"use client";

/**
 * Supabase 연결 (A · 현서) — 브라우저에서만 써요.
 *
 * .env.local의 NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY로 접속해요.
 * 둘 중 하나라도 없으면 null을 돌려주고, 화면은 지금처럼 가짜 데이터 데모로 움직여요.
 * 비밀 키(SUPABASE_SERVICE_ROLE_KEY)는 여기서 절대 쓰지 않아요 (서버 전용).
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

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

/** 지금 로그인한 사람. undefined = 확인 중, null = 로그인 안 함(또는 Supabase 키 없음) */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setUser(null);
      return;
    }
    void supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}
