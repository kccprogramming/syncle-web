/**
 * 회의 제안 화면에서 쓰는 작은 계산들.
 * 가짜 데이터(availableCount)는 "민지가 전부 가능, 지우는 응답 전" 기준이에요.
 * 데모 상태(내 응답, 지우 응답)에 맞춰 숫자만 고쳐서 보여줘요.
 */
import type { TimeOption } from "@/types";
import type { DemoState } from "@/lib/demo-store";

/** 이 시간 후보에 "응답한 사람 중 몇 명이 되는지" */
export function countFor(time: TimeOption, state: DemoState) {
  let available = time.availableCount;
  let responded = time.respondedCount;
  // 민지(나)가 이 시간을 빼면 한 명 줄어요
  if (!state.myPicks.includes(time.id)) available -= 1;
  // 지우가 응답했으면 응답 인원이 늘고, 고른 시간이면 가능 인원도 늘어요
  if (state.jiwooResponded) {
    responded += 1;
    if (state.jiwooPicks.includes(time.id)) available += 1;
  }
  return { available, responded };
}

/** "도보 4분" → 4 (가까운 순 정렬용) */
export function walkMinutes(walk: string) {
  const m = walk.match(/(\d+)분/);
  return m ? Number(m[1]) : 0;
}
