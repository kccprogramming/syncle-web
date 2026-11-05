/**
 * 우리 앱 ↔ C(시간 후보 · 회의 제안) 연결 계층. 서버에서만 써요.
 *
 * - buildProposal: B의 회의 조건 → C의 createProposal(시간 후보 계산) → 화면용 Proposal
 *   장소는 C의 findPlaces 대신 6 장소 후보(area-search)에서 따로 찾아요. 그래서 여기서는 빈 목록을 넘겨요.
 *
 * C 코드(src/server/c)는 받은 그대로 두고, 이름·모양을 맞추는 일은 여기서만 해요.
 */
import type { Message, Proposal, TimeOption } from "@/types";
import type { Conditions } from "./b/b-c-contract";
import { createProposal, type Proposal as CProposal } from "./c/features/proposals/create-proposal.ts";
import type { TimeCandidate } from "./c/features/scheduling/types.ts";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-11-11T19:00:00+09:00" → { date: "11/11(수)", time: "19:00" } (서울 시간) */
function seoulParts(iso: string) {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return { date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DAYS[d.getUTCDay()]})`, time: d.toISOString().slice(11, 16) };
}

function durationLabel(minutes: number) {
  if (minutes % 60 === 0) return `약 ${minutes / 60}시간`;
  return minutes > 60 ? `약 ${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
}

export interface BuiltProposal {
  proposal: Proposal;
  /** C가 남긴 경고 (예: 가능 시간이 미확인인 사람이 있어요) */
  warnings: string[];
}

/**
 * conditions: B가 뽑은(또는 예시) 회의 조건
 * base: 이 팀의 기존 제안 — C가 정하지 않는 값(응답 마감 등)을 이어받아요
 * 시간 후보가 하나도 없으면 null (화면은 5-3 '모두 되는 시간이 없을 때'로 안내)
 */
export async function buildProposal(args: {
  conditions: Conditions;
  base: Proposal;
  nameOf: (memberId: string) => string;
  messages: Message[];
}): Promise<BuiltProposal | null> {
  const { conditions, base, nameOf, messages } = args;
  const c: CProposal = await createProposal(
    { teamId: base.teamId, proposalId: base.id, dataMode: "live" },
    { extractConditions: async () => conditions, findPlaces: async () => [] },
  );
  const candidates = c.schedule.candidates;
  if (!candidates.length) return null;

  const members = conditions.schedule.members;
  const respondedIds = members.filter((m) => m.responseStatus === "provided").map((m) => m.memberId);
  const pendingIds = members.filter((m) => m.responseStatus !== "provided").map((m) => m.memberId);
  const names = (ids: string[]) => ids.map(nameOf).join(", ");
  const best = candidates[0];

  const times: TimeOption[] = candidates.map((t, i) => {
    const s = seoulParts(t.startAt);
    const e = seoulParts(t.endAt);
    const time: TimeOption = {
      id: `t-${i + 1}`, // 화면의 내 응답(myPicks)과 맞추려고 순서대로 t-1, t-2 … 로 불러요
      cTimeCandidateId: t.id, // C 확정 API에는 C의 진짜 ID를 넘겨요
      label: `${s.date} ${s.time}–${e.time}`,
      short: `${s.date} ${s.time}`,
      startAt: t.startAt,
      endAt: t.endAt,
      availableCount: t.availableCount,
      respondedCount: respondedIds.length,
      recommended: i === 0,
    };
    if (i > 0) Object.assign(time, whyNot(t, best, nameOf));
    return time;
  });

  const reasons = [
    `응답한 ${respondedIds.length}명 중 ${best.availableCount}명이 모두 되는 시간이에요`,
    pendingIds.length ? `${names(pendingIds)}님은 아직 몰라서 따로 물어볼게요` : "팀원 모두의 가능 시간을 확인했어요",
    `겹치지 않는 후보 ${candidates.length}개 중 가장 많이 되고 가장 빠른 시간이에요`,
  ];
  if (best.unavailableMemberIds.length) reasons.push(`${names(best.unavailableMemberIds)}님은 이 시간에 안 돼요`);

  const sources = conditions.sourceMessageIds.flatMap((id) => {
    const m = messages.find((x) => x.id === id);
    if (!m || (m.type !== "text" && m.type !== "mention-ai")) return [];
    return [{ who: nameOf(m.senderId), quote: m.text, effect: "AI가 조건을 정할 때 참고했어요" }];
  });

  const proposal: Proposal = {
    ...base,
    title: conditions.purpose,
    mode: conditions.meetingMode,
    durationLabel: durationLabel(conditions.schedule.durationMinutes),
    placeNote: conditions.placeRequirements[0] ?? base.placeNote,
    status: "collecting",
    respondedIds,
    pendingIds,
    pendingNote: pendingIds.length ? `${names(pendingIds)}님은 아직 응답 전` : "모두 응답했어요",
    times,
    reasons,
    agenda: conditions.agenda.length ? conditions.agenda : base.agenda,
    sources: sources.length ? sources : base.sources,
    cardSummary: { ...base.cardSummary, timeLabel: times[0].short, candidateCount: times.length },
  };
  return { proposal, warnings: c.warnings.map((w) => w.message) };
}

/** 1위가 아닌 후보의 '추천하지 않은 이유' */
function whyNot(t: TimeCandidate, best: TimeCandidate, nameOf: (id: string) => string): Pick<TimeOption, "whyNot" | "whyNotDetail"> {
  if (t.unavailableMemberIds.length) {
    const who = t.unavailableMemberIds.map(nameOf).join(", ");
    return { whyNot: `${who}님 불가`, whyNotDetail: `${who}님이 이 시간에 안 된다고 했어요` };
  }
  if (t.availableCount < best.availableCount) {
    return { whyNot: `가능 ${t.availableCount}명`, whyNotDetail: `가능한 사람이 ${t.availableCount}명으로 추천 시간보다 적어요` };
  }
  return { whyNot: "추천 시간보다 늦어요", whyNotDetail: "가능 인원은 같지만 추천 시간보다 늦은 날이에요" };
}
