"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

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
