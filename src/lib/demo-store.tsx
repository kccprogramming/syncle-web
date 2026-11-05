"use client";

/**
 * 프로토타입(가짜 데이터) 상태 저장소.
 *
 * 화면을 오가도 "확정했는지", "내 응답", "읽은 알림" 같은 상태가 이어지도록 여기에 모아요.
 * 새로고침해도 유지되게 sessionStorage에 저장하고, 저장이 막힌 브라우저에서는 메모리에만 둬요.
 * 백엔드를 연결하면 이 상태 대부분은 서버 데이터로 바뀌어요.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Condition, PlaceOption, PlaceSearchResult, WeeklyBlock } from "@/types";
import { getMe, getMyOrigin } from "@/lib/data";

export interface DemoState {
  /** 방장이 회의를 확정했는지 (5 → 3-4) */
  confirmed: boolean;
  /** 내(민지) 응답: 되는 시간 후보 id */
  myPicks: string[];
  /** 지우가 3-3에서 응답했는지 */
  jiwooResponded: boolean;
  jiwooPicks: string[];
  /** 회의 방식 */
  mode: "offline" | "online";
  /** 고른 장소 (6) */
  placeId: string;
  /** 6에서 실제 장소 추천(D)으로 고른 장소. 가짜 데이터에 없는 장소라 통째로 기억해요 */
  chosenPlace: PlaceOption | null;
  /** 7-1에서 직접 추가한 조건 */
  addedConditions: Condition[];
  /** 주로 출발하는 곳 (2, 1-1, 7) */
  origin: PlaceSearchResult | null;
  /** 매주 안 되는 시간 (2-2, 1-1) */
  weeklyBlocks: WeeklyBlock[];
  /** 알림 모두 읽음 */
  notificationsRead: boolean;
  /** 할 일 완료 체크 */
  taskDone: Record<string, boolean>;
  /** AI가 찾은 할 일을 추가했는지 */
  aiTaskAdded: boolean;
  /** 회의록 할 일을 팀 할 일에 추가했는지 */
  minutesTasksAdded: boolean;
  /** 팀 설정 */
  aiEnabled: boolean;
  aiScope: "all" | "mention";
  /** 2에서 새로 만든 팀 이름 */
  newTeamName: string | null;
}

const initialState = (): DemoState => ({
  confirmed: false,
  myPicks: ["t-1", "t-2", "t-3"],
  jiwooResponded: false,
  jiwooPicks: ["t-1"],
  mode: "offline",
  placeId: "A",
  chosenPlace: null,
  addedConditions: [],
  origin: getMyOrigin(),
  weeklyBlocks: getMe().weeklyBlocks,
  notificationsRead: false,
  taskDone: { "t-3": true },
  aiTaskAdded: false,
  minutesTasksAdded: false,
  aiEnabled: true,
  aiScope: "all",
  newTeamName: null,
});

const KEY = "syncle-demo-v1";

interface DemoContextValue {
  state: DemoState;
  update: (patch: Partial<DemoState> | ((s: DemoState) => Partial<DemoState>)) => void;
  reset: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(initialState);

  // 처음 열 때 저장된 상태 불러오기
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (raw) setState({ ...initialState(), ...(JSON.parse(raw) as Partial<DemoState>) });
    } catch {
      /* 저장소를 쓸 수 없으면 메모리 상태만 사용 */
    }
  }, []);

  const update = useCallback<DemoContextValue["update"]>((patch) => {
    setState((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      try {
        window.sessionStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* 무시 */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* 무시 */
    }
    setState(initialState());
  }, []);

  const value = useMemo(() => ({ state, update, reset }), [state, update, reset]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo는 DemoProvider 안에서만 쓸 수 있어요");
  return ctx;
}
