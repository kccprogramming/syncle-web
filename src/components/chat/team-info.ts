"use client";

/**
 * 대화방·팀 메뉴 화면들이 같이 쓰는 계산 모음.
 * 데이터는 data.ts 함수로만 가져오고, 여기서는 화면에 보여 줄 모양으로 바꾸기만 해요.
 */
import { useState } from "react";
import { getMeetings, getPlaces, getProposal, getTasks, getMinutes, getMember, getMe } from "@/lib/data";
import { useDemo, type DemoState } from "@/lib/demo-store";
import type { Meeting, PlaceOption, Proposal, Task, Team } from "@/types";

/** 프로토타입 상태(useDemo)가 이어지는 팀. 다른 팀은 mock 데이터 그대로 보여요. */
export const DEMO_TEAM_ID = "hci4";

// TODO: API 연결 시 data.ts로 옮기기 (팀에 고정된 마감 메시지)
const TEAM_DEADLINES: Record<string, string> = {
  hci4: "자료 마감 11/13(금) 18:00",
};
// TODO: API 연결 시 data.ts로 옮기기 (요약 줄에 쓰는 짧은 회의 이름)
const SHORT_TITLES: Record<string, string> = {
  "p-1": "역할 분담 회의",
};

/** 이 팀에서 진행 중인 회의 제안 (없으면 null). c: C가 만든 제안 (데모 상태의 cProposal) */
export function getTeamProposal(teamId: string, c?: Proposal | null): Proposal | null {
  const p = c ?? getProposal("p-1");
  return p.teamId === teamId ? p : null;
}

/** 응답한 사람 수 (지우가 3-3에서 응답했으면 1명 더해요) */
export function respondedText(p: Proposal, state: DemoState): string {
  const total = p.respondedIds.length + p.pendingIds.length;
  const done = p.respondedIds.length + (state.jiwooResponded ? 1 : 0);
  return `${Math.min(done, total)}/${total}명`;
}

/** 고른 장소를 찾는 데 필요한 값 (데모 상태의 placeId, chosenPlace) */
export type PlacePick = Pick<DemoState, "placeId" | "chosenPlace">;

/** 고른 장소 (6에서 바꿨으면 그 장소). 실제 추천(D)에서 고른 장소가 있으면 그걸 먼저 써요 */
export function getChosenPlace(proposalId: string, pick: PlacePick): PlaceOption {
  if (pick.chosenPlace && pick.chosenPlace.id === pick.placeId) return pick.chosenPlace;
  const list = getPlaces(proposalId).places;
  return list.find((p) => p.id === pick.placeId) ?? list[0];
}

/**
 * 팀 회의 목록.
 * - proposal: 아직 확정 전인 제안 (확정되면 null)
 * - upcoming: 확정된 다가오는 회의 (제안에서 나온 회의는 확정된 뒤에만 보여요)
 * - past: 지난 회의
 */
export function getTeamMeetings(teamId: string, confirmed: boolean, c?: Proposal | null) {
  const all = getMeetings().filter((m) => m.teamId === teamId);
  const proposal = getTeamProposal(teamId, c);
  const isDemo = teamId === DEMO_TEAM_ID;
  return {
    proposal: proposal && !(isDemo && confirmed) ? proposal : null,
    upcoming: all.filter((m) => m.status === "upcoming" && (!m.proposalId || (isDemo && confirmed))),
    past: all.filter((m) => m.status === "past"),
  };
}

/** 확정 회의 한 줄: "11/11(수) 19:00 · 스터디룸 A" */
export function meetingLine(m: Meeting, pick: PlacePick): string {
  const place = m.proposalId ? getChosenPlace(m.proposalId, pick).short : m.placeName;
  return `${m.shortLabel} · ${place}`;
}

/** 할 일 한 줄에 보여 줄 모양 */
export interface TaskView {
  id: string;
  title: string;
  meta: string;
  mine: boolean;
  done: boolean;
  /** mock 데이터에서 처음부터 끝나 있던 할 일 */
  wasDone: boolean;
}

/**
 * 팀 할 일 목록. AI가 찾은 할 일을 추가했거나 회의록 할 일을 추가했으면 함께 보여요.
 * 완료 체크는 state.taskDone이 정해요.
 */
export function getTeamTaskViews(teamId: string, state: DemoState): { list: TaskView[]; suggestion: Task | null } {
  const me = getMe();
  const { tasks, aiSuggestion } = getTasks(teamId);
  const isDemo = teamId === DEMO_TEAM_ID;
  const doneOf = (t: { id: string; done?: boolean }) => (isDemo ? state.taskDone[t.id] ?? !!t.done : !!t.done);

  const toView = (t: Task, extra = ""): TaskView => {
    const mine = t.assigneeId === me.id;
    return {
      id: t.id,
      title: t.title,
      meta: `${getMember(t.assigneeId).name}${mine ? "(나)" : ""} · ${t.due}${extra}`,
      mine,
      done: doneOf(t),
      wasDone: t.done,
    };
  };

  const list: TaskView[] = tasks.map((t) => toView(t));
  if (isDemo && aiSuggestion && state.aiTaskAdded) list.push(toView(aiSuggestion, " · AI가 찾음"));
  if (isDemo && state.minutesTasksAdded) {
    for (const t of getMinutes("m-0").tasks) {
      list.push({ id: t.id, title: t.title, meta: `${t.meta} · 회의록에서`, mine: false, done: doneOf(t), wasDone: false });
    }
  }
  // 처음부터 끝난 할 일은 아래로 (누를 때마다 순서가 바뀌지 않게 원래 값으로 정렬)
  list.sort((a, b) => Number(a.wasDone) - Number(b.wasDone));

  return { list, suggestion: aiSuggestion && !(isDemo && state.aiTaskAdded) ? aiSuggestion : null };
}

/** 대화방 위 요약 줄의 '할 일' 문장 (없으면 null) */
export function taskSummary(teamId: string, state: DemoState): string | null {
  const myOpen = getTeamTaskViews(teamId, state).list.filter((t) => t.mine && !t.done).length;
  const parts = [TEAM_DEADLINES[teamId], myOpen > 0 ? `내 할 일 ${myOpen}개` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function shortTitle(p: Proposal): string {
  return SHORT_TITLES[p.id] ?? p.title;
}

/**
 * AI 도우미 켜짐/꺼짐.
 * 데모 팀은 화면 사이에 이어지게 useDemo에 저장하고, 다른 팀은 이 화면 안에서만 바뀌어요.
 */
export function useTeamAi(team: Team) {
  const { state, update } = useDemo();
  const [localOn, setLocalOn] = useState(team.aiEnabled);
  if (team.id === DEMO_TEAM_ID) {
    return { aiOn: state.aiEnabled, setAiOn: (on: boolean) => update({ aiEnabled: on }) };
  }
  return { aiOn: localOn, setAiOn: setLocalOn };
}

/** 팀 초대 링크 복사 (복사가 막힌 브라우저면 조용히 넘어가요) */
export function copyInviteLink(team: Team) {
  try {
    void navigator.clipboard?.writeText(`${window.location.origin}/invite/${team.inviteCode}`).catch(() => {});
  } catch {
    /* 무시 */
  }
}
