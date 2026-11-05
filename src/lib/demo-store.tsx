"use client";

/**
 * 프로토타입(가짜 데이터) 상태 저장소.
 *
 * 화면을 오가도 "확정했는지", "내 응답", "읽은 알림" 같은 상태가 이어지도록 여기에 모아요.
 * 새로고침해도 유지되게 sessionStorage에 저장하고, 저장이 막힌 브라우저에서는 메모리에만 둬요.
 * 백엔드를 연결하면 이 상태 대부분은 서버 데이터로 바뀌어요.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Condition, ConfirmRequest, PlaceOption, PlaceSearchResult, Proposal, WeeklyBlock } from "@/types";
import { getMe, getMyOrigin, getProposal } from "@/lib/data";
import type { PlaceIntent } from "@/lib/place-intent";

export interface DemoState {
  /** C가 시간 후보를 계산해서 만든 회의 제안 (3 '@AI … 잡아줘' 뒤). 없으면 가짜 데이터의 제안을 보여줘요 */
  cProposal: Proposal | null;
  /** 방장이 회의를 확정했는지 (5 → 3-4) */
  confirmed: boolean;
  /** 확정할 때 C에 넘긴 값 (시간 후보 ID + 6에서 고른 장소 ID). 서버가 생기면 확정된 회의로 바뀌어요 */
  confirmRequest: ConfirmRequest | null;
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
  /** 주로 출발하는 곳 (2, 1-1, 7) — 나(민지) */
  origin: PlaceSearchResult | null;
  /** 다른 팀원이 팀에 들어오며 직접 정한 출발지 (2-1). 실제로는 각자 계정의 프로필에 저장돼요 */
  memberOrigins: Record<string, PlaceSearchResult>;
  /** AI가 대화를 보고 고른 장소 종류 (합주실 · 회의 장소 · 회식 장소 …) — 3 '@AI … 잡아줘' 뒤에 정해져요 */
  aiPlaceIntent: PlaceIntent | null;
  /** 6에서 사람이 직접 바꾼 장소 종류. null이면 AI가 고른 것을 따라가요 */
  placeKeyword: string | null;
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
  cProposal: null,
  confirmed: false,
  confirmRequest: null,
  myPicks: ["t-1", "t-2", "t-3"],
  jiwooResponded: false,
  jiwooPicks: ["t-1"],
  mode: "offline",
  placeId: "A",
  chosenPlace: null,
  addedConditions: [],
  origin: getMyOrigin(),
  memberOrigins: {},
  aiPlaceIntent: null,
  placeKeyword: null,
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

/** 회의 제안 하나. C가 만든 제안이 있으면 그걸, 없으면 가짜 데이터(data.ts getProposal)를 돌려줘요 */
export function useProposal(proposalId: string): Proposal {
  const { state } = useDemo();
  const c = state.cProposal;
  return c && c.id === proposalId ? c : getProposal(proposalId);
}
