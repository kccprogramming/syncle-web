"use client";

/**
 * 회의 제안 만들기 시트 (진짜 팀 · C)
 * 대화방에서 '@AI 회의 잡아줘'를 보내면 열려요. 한 번에 끝나게, AI(B)가 꼭 알아야 하지만 추측하지 않는 것은 여기서 받아요:
 * - 무엇을 위한 회의 · 얼마나 · 대면/온라인  → 대화방에 '@AI 회의 잡아줘 · 목적 … · 1시간 · 대면' 메시지로 남겨요
 *   (B가 대화를 읽고 정리하니 메시지로 남겨야 다시 묻지 않아요. 팀원도 어떤 조건으로 잡았는지 볼 수 있어요)
 * - 시간을 찾을 기간 · 응답 마감 · 자료 마감 → C에 그대로 보내요 (C는 마감을 대신 정하지 않아요). 기본값이 있어서 '펼치기'로 접어 둬요
 * 보내면 C가 대화를 읽고(B · Gemini) 시간 후보를 계산해 제안을 저장해요.
 */
import { useMemo, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { sendTeamMessage } from "@/lib/data";
import { checkDeadlines, createLiveProposal } from "@/lib/scheduling-client";
import type { Message } from "@/types";

/** 이 기기 시간 기준 날짜 칸 값 "2026-11-07" */
function dateValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** "2026-11-14" → "2026-11-15" */
function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return dateValue(new Date(y, m - 1, d + 1));
}
/** 날짜 + 시각 칸 값 → 서울 시간 ISO ("2026-11-07T21:00" → "2026-11-07T21:00:00+09:00") */
const kst = (local: string) => (local.length === 16 ? `${local}:00+09:00` : local);
/** "2026-11-07T21:00" → "11/7 21:00" */
const short = (local: string) => {
  const [d, t] = local.split("T");
  const [, m, day] = d.split("-").map(Number);
  return `${m}/${day}${t ? ` ${t}` : ""}`;
};

const LENGTHS = [
  { min: 30, label: "30분" },
  { min: 60, label: "1시간" },
  { min: 90, label: "1시간 30분" },
  { min: 120, label: "2시간" },
];

type Result =
  | { status: string; proposal?: { id: string; title: string; responseDeadline: string }; message?: string; questions?: { question?: string; text?: string }[] }
  | undefined;

export function CreateProposalSheet({
  teamId,
  teamName,
  onClose,
  onCreated,
  onMessage,
}: {
  teamId: string;
  /** 목적 칸 기본값에 써요 ("KCC해커톤 회의") */
  teamName: string;
  onClose: () => void;
  onCreated: (p: { proposalId: string; title: string; responseDeadline: string }) => void;
  /** 조건 메시지를 대화방에 남겼을 때 (바로 화면에 보이게) */
  onMessage?: (m: Message) => void;
}) {
  // 기본값: 응답 마감 내일 21시, 기간 모레부터 7일, 자료 마감 기간 첫날 9시
  const defaults = useMemo(() => {
    const day = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return dateValue(d);
    };
    return { from: day(2), to: day(8), response: `${day(1)}T21:00`, material: `${day(2)}T09:00` };
  }, []);
  const [purpose, setPurpose] = useState(`${teamName} 회의`);
  const [length, setLength] = useState(60);
  const [mode, setMode] = useState<"offline" | "online">("offline");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [response, setResponse] = useState(defaults.response);
  const [material, setMaterial] = useState(defaults.material);
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [posted, setPosted] = useState(""); // 이미 남긴 조건 메시지 (다시 시도할 때 또 남기지 않게)

  const lengthLabel = LENGTHS.find((l) => l.min === length)?.label ?? `${length}분`;
  // '잡아줘'가 있어야 B가 일정 잡기로 알아들어요. '장소'라는 말은 장소 요청으로 오해해서 쓰지 않아요
  const conditionText = `@AI 회의 잡아줘 · 목적: ${purpose.trim()} · 회의 길이 ${lengthLabel} · ${mode === "offline" ? "대면" : "온라인"}으로`;
  const problem = !purpose.trim()
    ? "무엇을 위한 회의인지 적어 주세요"
    : !from || !to || from > to
      ? "시간을 찾을 기간을 확인해 주세요"
      : checkDeadlines(kst(response), kst(material));

  async function submit() {
    if (problem || busy) return;
    setBusy(true);
    setError("");
    try {
      // 1) 조건을 대화방에 남겨요 (B가 이 메시지를 읽고 목적 · 길이 · 방식을 다시 묻지 않아요)
      if (posted !== conditionText) {
        const m = await sendTeamMessage(teamId, conditionText);
        setPosted(conditionText);
        onMessage?.(m);
      }
      // 2) C에 제안 만들기 (기간 · 마감 두 개를 꼭 같이)
      const r = (await createLiveProposal(teamId, {
        text: conditionText,
        referenceDate: dateValue(new Date()),
        // 끝 날짜 하루 전체를 넣으려고 다음 날 0시까지 (예: '저녁 7시 이후'가 24시까지여도 기간 안에 들어가요)
        searchWindow: { startAt: `${from}T00:00:00+09:00`, endAt: `${nextDay(to)}T00:00:00+09:00` },
        responseDeadline: kst(response),
        materialDeadline: kst(material),
      })) as Result;
      if (r?.proposal) {
        onCreated({ proposalId: r.proposal.id, title: r.proposal.title, responseDeadline: r.proposal.responseDeadline });
        return;
      }
      // 제안까지 못 간 경우: AI가 그래도 모르는 게 있거나(확인 질문), 회의 잡기가 아닌 요청이에요
      const asked = r?.questions?.map((q) => q.question ?? q.text).filter(Boolean).join(" · ");
      setError(asked ? `AI가 확인할 게 있어요 · ${asked}` : (r?.message ?? "회의 조건을 정리하지 못했어요 · 대화를 조금 더 나눈 뒤 다시 해 주세요"));
    } catch (e) {
      const m = e instanceof Error ? e.message : "제안을 만들지 못했어요";
      // C는 AI(B)가 정리한 시간이 규칙에 안 맞으면 이 문구만 돌려줘요 → 무엇을 하면 되는지 같이 알려줘요
      setError(
        m.includes("입력 형식과 회의 조건")
          ? "AI가 대화에서 되는 시간을 정확히 읽지 못했어요. 대화방에 날짜와 시간을 구체적으로 남긴 뒤 다시 해 주세요 · 예: ‘11/10(화) 19:00~22:00 가능’"
          : m,
      );
    }
    setBusy(false);
  }

  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} type="button" aria-pressed={on} className={`chip${on ? " chip--on" : ""}`} style={{ minHeight: 36 }} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <Sheet open onClose={onClose} title="회의 제안 만들기" sub="AI가 팀 대화를 읽고 모두 되는 시간을 찾아요">
      <label className="stack gap-6">
        <span className="t-13 t-muted">무엇을 위한 회의인가요?</span>
        <input className="input" type="text" maxLength={40} placeholder="예: 발표 준비" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </label>
      <div className="stack gap-6">
        <span className="t-13 t-muted">얼마나 할까요?</span>
        <div className="hstack gap-8" style={{ flexWrap: "wrap" }}>
          {LENGTHS.map((l) => chip(length === l.min, l.label, () => setLength(l.min)))}
        </div>
      </div>
      <div className="stack gap-6">
        <span className="t-13 t-muted">어떻게 만날까요?</span>
        <div className="hstack gap-8">
          {chip(mode === "offline", "대면", () => setMode("offline"))}
          {chip(mode === "online", "온라인", () => setMode("online"))}
        </div>
      </div>

      {/* 기간 · 마감: 기본값이 있어서 접어 둬요 */}
      <button
        type="button"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen(!moreOpen)}
        className="hstack gap-8"
        style={{ border: 0, background: "var(--bg)", borderRadius: 12, padding: "10px 12px", textAlign: "left" }}
      >
        <span className="stack grow" style={{ gap: 2 }}>
          <span className="t-13 t-ink2">
            {short(from)} ~ {short(to)}에서 찾기
          </span>
          <span className="t-12 t-muted">
            응답 마감 {short(response)} · 자료 마감 {short(material)}
          </span>
        </span>
        <span className="t-13 t-accent no-shrink">{moreOpen ? "접기" : "바꾸기"}</span>
      </button>
      {moreOpen ? (
        <>
          <div className="stack gap-6">
            <span className="t-13 t-muted">시간을 찾을 기간</span>
            <div className="hstack gap-8">
              <input className="input grow" type="date" aria-label="기간 시작" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="t-13 t-muted">~</span>
              <input className="input grow" type="date" aria-label="기간 끝" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <label className="stack gap-6">
            <span className="t-13 t-muted">응답 마감 · 이때까지 팀원이 되는 시간을 골라요</span>
            <input className="input" type="datetime-local" value={response} onChange={(e) => setResponse(e.target.value)} />
          </label>
          <label className="stack gap-6">
            <span className="t-13 t-muted">자료 마감 · 회의 전에 자료를 올릴 때까지</span>
            <input className="input" type="datetime-local" value={material} onChange={(e) => setMaterial(e.target.value)} />
          </label>
        </>
      ) : null}

      {problem ? <span className="t-12 t-warn">{problem}</span> : null}
      {error ? (
        <span role="alert" className="t-13 t-warn" style={{ lineHeight: 1.5 }}>
          {error}
        </span>
      ) : null}
      <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={!!problem || busy} onClick={() => void submit()}>
        {busy ? "AI가 정리하는 중…" : "제안 만들기"}
      </button>
    </Sheet>
  );
}
