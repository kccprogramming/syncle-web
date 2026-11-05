"use client";

/**
 * 2-2 매주 안 되는 시간 추가 시트.
 * 2 새 팀 만들기와 1-1 내 정보에서 같이 써요.
 * 시트를 열 때마다 새로 그려지도록, 부모에서 {open && <WeeklyBlockSheet ... />}처럼 써요.
 */
import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import type { WeeklyBlock } from "@/types";

export const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];

// 07:00 ~ 24:00, 한 시간 간격
const TIMES = Array.from({ length: 18 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

/** 칩에 보이는 글자: "월·수 10:00–12:00 수업" */
export function formatBlock(b: WeeklyBlock) {
  const days = DAY_ORDER.filter((d) => b.days.includes(d)).join("·");
  const time = b.allDay ? "하루 종일" : `${b.start}–${b.end}`;
  return `${days} ${time}${b.memo ? " " + b.memo : ""}`;
}

/** 시트를 처음 열 때 채워 둘 값 */
export interface WeeklyDraft {
  days: string[];
  allDay: boolean;
  start: string;
  end: string;
  memo: string;
}
export const EMPTY_DRAFT: WeeklyDraft = { days: [], allDay: false, start: "14:00", end: "18:00", memo: "" };

export function WeeklyBlockSheet({
  initial = EMPTY_DRAFT,
  onClose,
  onAdd,
}: {
  initial?: WeeklyDraft;
  onClose: () => void;
  onAdd: (block: WeeklyBlock) => void;
}) {
  const [draft, setDraft] = useState<WeeklyDraft>(initial);
  const set = (patch: Partial<WeeklyDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // 요일을 하나 이상 고르고, 시간이 맞아야 추가할 수 있어요
  const canAdd = draft.days.length > 0 && (draft.allDay || draft.start < draft.end);

  function toggleDay(day: string) {
    set({ days: draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day] });
  }

  function add() {
    if (!canAdd) return;
    onAdd({
      id: `wb-${Date.now()}`,
      days: DAY_ORDER.filter((d) => draft.days.includes(d)),
      allDay: draft.allDay,
      start: draft.allDay ? undefined : draft.start,
      end: draft.allDay ? undefined : draft.end,
      memo: draft.memo.trim() || undefined,
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="매주 안 되는 시간 추가"
      sub="수업·알바처럼 매주 반복되는 일정을 알려주면 AI가 피해서 제안해요"
    >
      {/* 요일 */}
      <div className="field">
        <span className="field__label">요일 (여러 개 선택 가능)</span>
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          {DAY_ORDER.map((d) => {
            const on = draft.days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: on ? 0 : "1px solid var(--line-strong)",
                  background: on ? "var(--accent)" : "var(--surface)",
                  color: on ? "#fff" : "var(--ink)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* 시간 */}
      <div className="field">
        <span className="field__label">시간</span>
        <label className="hstack gap-10 t-14" style={{ minHeight: 32 }}>
          <input
            type="checkbox"
            checked={draft.allDay}
            onChange={(e) => set({ allDay: e.target.checked })}
            style={{ width: 20, height: 20, accentColor: "var(--accent)", margin: 0 }}
          />
          하루 종일
        </label>
        {!draft.allDay && (
          <div className="hstack gap-10">
            <select
              aria-label="시작 시간"
              className="input"
              value={draft.start}
              onChange={(e) => set({ start: e.target.value })}
              style={{ flex: "1 1 0", padding: "0 12px" }}
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="t-muted">~</span>
            <select
              aria-label="끝 시간"
              className="input"
              value={draft.end}
              onChange={(e) => set({ end: e.target.value })}
              style={{ flex: "1 1 0", padding: "0 12px" }}
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 메모 */}
      <div className="field">
        <label htmlFor="weekly-memo" className="field__label">메모 (선택)</label>
        <input
          id="weekly-memo"
          className="input"
          type="text"
          placeholder="예: 수업, 알바"
          value={draft.memo}
          onChange={(e) => set({ memo: e.target.value })}
        />
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn--ghost btn--lg" style={{ fontSize: 15 }} onClick={onClose}>
          취소
        </button>
        <button type="button" className="btn btn--primary btn--lg" style={{ flex: "2 1 0" }} disabled={!canAdd} onClick={add}>
          {canAdd ? "추가하기" : "요일을 골라주세요"}
        </button>
      </div>
    </Sheet>
  );
}
