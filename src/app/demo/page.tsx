"use client";

/**
 * 발표 QR이 여는 데모 시작점.
 * 데모 상태를 처음으로 되돌리고 데모 모드를 켠 뒤 스플래시(0)로 보내요.
 * 흐름: 스플래시 → 로그인(실제 Google 없이) → 빈 홈 → 새 팀 만들기 → 예시 대화가 있는 대화방
 *      → '@AI 회의 잡아줘'(예시 AI, Gemini를 부르지 않아요) → 되는 시간 · 장소 찾기 · 확정 → 회의 카드
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { resetDemoScheduling, setDemoMode } from "@/lib/demo-scheduling";
import { useDemo } from "@/lib/demo-store";

export default function DemoStart() {
  const router = useRouter();
  const { reset } = useDemo();
  useEffect(() => {
    reset();
    resetDemoScheduling();
    setDemoMode(true);
    router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <main className="screen" style={{ background: "var(--accent)" }} />;
}
