"use client";

/** 7-1 조건 직접 추가 시트: 이번 회의에만 쓰는 시간 조건을 하나 추가해요. */
import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { CheckBox } from "@/components/Controls";
import type { Condition } from "@/types";

// 다음 주 날짜 (11/9 월 ~ 11/15 일)
// TODO: API 연결 시 제안의 날짜 범위에서 만들기
const DAYS = [
  { dow: "월", date: 9 },
  { dow: "화", date: 10 },
  { dow: "수", date: 11 },
  { dow: "목", date: 12 },
  { dow: "금", date: 13 },
  { dow: "토", date: 14 },
  { dow: "일", date: 15 },
];
const STARTS = ["18:00", "19:00", "20:00"];
const ENDS = ["20:00", "21:00", "22:00"];

export type ConditionKind = Condition["kind"];

export function AddConditionSheet({
  initialKind,
  onClose,
  onAdd,
}: {
  initialKind: ConditionKind;
  onClose: () => void;
  onAdd: (c: Condition) => void;
}) {
  const [kind, setKind] = useState<ConditionKind>(initialKind);
  const [dayIndex, setDayIndex] = useState(-1); // -1 = 아직 안 고름
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("19:00");
  const [end, setEnd] = useState("21:00");
  const [memo, setMemo] = useState("");

  const day = DAYS[dayIndex];
  const when = day ? `11/${day.date}(${day.dow}) ${allDay ? "하루 종일" : `${start}–${end}`}` : "";
  const timeOk = allDay || start < end;
  const can = !!day && timeOk;

  function add() {
    if (!can) return;
    onAdd({
      id: `c-added-${Date.now()}`,
      title: when + (kind === "prefer" ? " 선호" : ""),
      source: memo.trim() ? `직접 추가 · ${memo.trim()}` : "직접 추가 · 이번 회의만",
      fromAi: false,
      kind,
    });
  }

  let addLabel = "날짜를 골라주세요";
  if (day && !timeOk) addLabel = "끝 시간을 시작보다 늦게 골라주세요";
  if (can) addLabel = `${when} · ${kind === "no" ? "안 돼요" : "이때가 좋아요"}`;

  return (
    <Sheet open onClose={onClose} title="조건 직접 추가" sub="이번 회의를 정할 때만 써요 · 매주 반복은 내 정보에서">
      <div className="field">
        <span className="field__label">종류</span>
        <div className="btn-row" role="radiogroup" aria-label="종류">
          {(
            [
              ["no", "안 되는 시간"],
              ["prefer", "되면 좋은 시간"],
            ] as const
          ).map(([id, label]) => {
            const on = kind === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(id)}
                className={`option${on ? " option--on" : ""}`}
                style={{ minHeight: 40, justifyContent: "center", fontSize: 14, color: on ? "var(--accent-strong)" : "var(--ink-2)", fontWeight: on ? 600 : 400 }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <span className="field__label">
          날짜 <span className="t-muted" style={{ fontWeight: 400 }}>· 다음 주</span>
        </span>
        <div className="hstack gap-6">
          {DAYS.map((d, i) => {
            const on = dayIndex === i;
            return (
              <button
                key={d.date}
                type="button"
                aria-pressed={on}
                aria-label={`11월 ${d.date}일 ${d.dow}요일`}
                onClick={() => setDayIndex(i)}
                className="stack"
                style={{
                  flex: "1 1 0",
                  height: 50,
                  padding: 0,
                  borderRadius: 10,
                  border: on ? 0 : "1px solid var(--line)",
                  background: on ? "var(--accent)" : "var(--surface)",
                  color: on ? "#fff" : "var(--ink)",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                }}
              >
                <span style={{ fontSize: 11 }}>{d.dow}</span>
                <span className="t-15 t-strong">{d.date}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <button
          type="button"
          aria-pressed={allDay}
          onClick={() => setAllDay(!allDay)}
          className="hstack gap-8 t-13 t-strong"
          style={{ alignSelf: "flex-start", minHeight: 32, padding: 0, border: 0, background: "none" }}
        >
          <CheckBox on={allDay} />
          하루 종일
        </button>
        {allDay ? null : (
          <div className="hstack gap-8">
            <select aria-label="시작 시간" className="input grow" style={{ height: 44, borderRadius: 10, padding: "0 10px" }} value={start} onChange={(e) => setStart(e.target.value)}>
              {STARTS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <span className="t-muted">–</span>
            <select aria-label="끝 시간" className="input grow" style={{ height: 44, borderRadius: 10, padding: "0 10px" }} value={end} onChange={(e) => setEnd(e.target.value)}>
              {ENDS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <input
        aria-label="메모"
        className="input"
        style={{ height: 44, borderRadius: 10, padding: "0 12px", fontSize: 14 }}
        placeholder="메모 (선택) · 예: 동아리 정기 모임"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
      />

      <button type="button" className="btn btn--primary no-shrink" style={{ height: 50 }} disabled={!can} onClick={add}>
        {addLabel}
      </button>
    </Sheet>
  );
}
