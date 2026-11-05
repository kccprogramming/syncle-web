/**
 * 우리 앱 ↔ B(회의 조건 추출) 연결 계층. 서버에서만 써요.
 *
 * - toExtractionInput: 팀·팀원·대화 메시지 → B의 ExtractionInput (src/server/b/b-c-contract.ts)
 * - toReply: B의 handleAiRequest 결과 → 대화방 AI 답 카드(AiReply)
 *
 * B 코드(src/server/b)는 받은 그대로 두고, 이름·모양을 맞추는 일은 여기서만 해요.
 */
import type { AiReply, Message, Team } from "@/types";
import type { ExtractionInput } from "./b/b-c-contract";
import type { MvpRequestResult } from "./b/mvp";

/** 서울 날짜 "2026-11-05" */
export function seoulDate(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** "다음 주" 월요일 0시 ~ 그다음 월요일 0시 (서울). B는 이 구간 안에서만 시간을 찾아요 */
export function nextWeekWindow(referenceDate: string) {
  const d = new Date(`${referenceDate}T00:00:00Z`);
  const daysToMon = ((8 - d.getUTCDay()) % 7) || 7;
  const start = new Date(d.getTime() + daysToMon * 86400_000);
  const end = new Date(start.getTime() + 7 * 86400_000);
  const iso = (x: Date) => `${x.toISOString().slice(0, 10)}T00:00:00+09:00`;
  return { startAt: iso(start), endAt: iso(end) };
}

/** 화면용 메시지 → B 입력. 글·@AI 메시지만 넘기고, at("10:12")을 오늘 서울 시각으로 바꿔요 */
export function toExtractionInput(args: {
  team: Team;
  members: { memberId: string; name: string; station: string | null }[];
  messages: Message[];
  referenceDate: string;
}): ExtractionInput {
  const { team, members, messages, referenceDate } = args;
  const memberIds = members.map((m) => m.memberId);
  const usable = messages.flatMap((m) => {
    if ((m.type !== "text" && m.type !== "mention-ai") || !memberIds.includes(m.senderId)) return [];
    const hhmm = /^\d{2}:\d{2}$/.test(m.at) ? m.at : "09:00";
    return [{ id: m.id, senderId: m.senderId, text: m.type === "mention-ai" ? `@AI ${m.text}` : m.text, sentAt: `${referenceDate}T${hhmm}:00+09:00` }];
  });
  return {
    teamId: team.id,
    timezone: "Asia/Seoul",
    referenceDate,
    searchWindow: nextWeekWindow(referenceDate),
    requiredMemberIds: memberIds,
    members,
    messages: usable,
  };
}

/** B 결과 → 대화방 답 카드 */
export function toReply(result: MvpRequestResult, nameOf: (memberId: string) => string): AiReply {
  switch (result.status) {
    case "ignored":
      return { kind: "notice", title: "AI를 부르려면 @AI를 붙여 주세요", basis: "메시지에 @AI가 없어서 읽지 않았어요", items: [] };
    case "not_supported":
    case "clarify_request":
      return { kind: "notice", title: result.message, basis: "지금은 회의 잡기만 AI가 직접 정리해요", items: [{ text: "@AI 회의 잡아줘" }] };
    case "ready":
      return conditionsReply(result.conditions, nameOf);
    case "needs_confirmation":
      // 초안이 있으면 조건 카드 + '확인 N명'으로 보여줘요 (사람별 질문은 C 후보가 나온 뒤 B가 따로 만들어요)
      if (result.draft) return conditionsReply(result.draft, nameOf);
      return {
        kind: "questions",
        title: "회의를 잡기 전에 확인할 게 있어요",
        basis: "대화만으로는 정할 수 없어서 추측하지 않았어요",
        items: result.questions.map((q) => ({ text: q.question, sub: q.memberId ? `${nameOf(q.memberId)}님` : undefined })),
      };
  }
}

type Conditions = Extract<MvpRequestResult, { status: "ready" }>["conditions"];
function conditionsReply(c: Conditions, nameOf: (id: string) => string): AiReply {
  const by = (s: string) => c.schedule.members.filter((m) => m.responseStatus === s).map((m) => nameOf(m.memberId));
  const provided = by("provided");
  const waiting = [...by("missing"), ...by("needs_confirmation")];
  const items: AiReply["items"] = [
    { text: `목적 · ${c.purpose}` },
    { text: `길이 · ${c.schedule.durationMinutes}분 · ${c.meetingMode === "online" ? "온라인" : "대면"}` },
  ];
  if (c.placeRequirements.length) items.push({ text: `필요한 곳 · ${c.placeRequirements.join(", ")}` });
  if (c.agenda.length) items.push({ text: `안건 · ${c.agenda.join(", ")}` });
  items.push({
    text: `가능 시간을 말한 사람 · ${provided.length ? provided.join(", ") : "아직 없어요"}`,
    sub: waiting.length ? `${waiting.join(", ")}님에게 따로 물어볼게요` : undefined,
    tag: waiting.length ? `확인 ${waiting.length}명` : undefined,
  });
  return {
    kind: "conditions",
    title: "AI가 이해한 회의 조건",
    basis: `메시지 ${c.sourceMessageIds.length}개를 근거로 정리했어요 · 아래 시간 후보는 아직 예시 데이터예요`,
    items,
  };
}
