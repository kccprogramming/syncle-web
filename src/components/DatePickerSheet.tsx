"use client";

/**
 * 날짜(와 시간) 고르기 시트 — 시간 휠(TimeWheelSheet)과 같은 모양으로 맞춘 달력.
 * 브라우저 기본 달력 대신 써서 제안 만들기의 기간 · 응답 마감 · 자료 마감이 한 느낌으로 보여요.
 *
 * value: "YYYY-MM-DD" (withTime이면 "YYYY-MM-DDTHH:mm")
 * min / max: "YYYY-MM-DD" — 이 밖의 날짜는 흐리게, 고를 수 없어요
 */
import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { ROW, Wheel } from "@/components/TimeWheelSheet";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** 오늘 (서울) "YYYY-MM-DD" */
function today() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** "2026-11-08" → "11/8(일)" */
export function dateLabel(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(d.getTime()) ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]})` : date;
}

export function DatePickerSheet({
  title,
  value,
  min,
  max,
  withTime = false,
  onClose,
  onConfirm,
}: {
  title: string;
  value: string;
  min?: string;
  max?: string;
  withTime?: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const [date, setDate] = useState(value.slice(0, 10));
  const [hour, setHour] = useState(withTime ? Number(value.slice(11, 13)) || 0 : 0);
  const [minute, setMinute] = useState(withTime && value.slice(14, 16) === "30" ? 30 : 0);
  // 보고 있는 달
  const [view, setView] = useState(() => ({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 }));

  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const now = today();
  const move = (delta: number) => setView((v) => ({ y: v.y + Math.floor((v.m + delta) / 12), m: (((v.m + delta) % 12) + 12) % 12 }));
  const allowed = (d: string) => (!min || d >= min) && (!max || d <= max);

  return (
    <Sheet open onClose={onClose} title={title}>
      {/* 달 넘기기 */}
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <button type="button" className="icon-btn" aria-label="이전 달" onClick={() => move(-1)} style={{ transform: "scaleX(-1)" }}>
          <Icon name="arrowRight" size={20} strokeWidth={2} />
        </button>
        <span className="t-15 t-strong">
          {view.y}년 {view.m + 1}월
        </span>
        <button type="button" className="icon-btn" aria-label="다음 달" onClick={() => move(1)}>
          <Icon name="arrowRight" size={20} strokeWidth={2} />
        </button>
      </div>

      {/* 달력 */}
      <div role="grid" aria-label={`${view.y}년 ${view.m + 1}월`} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 4, textAlign: "center" }}>
        {DOW.map((d) => (
          <span key={d} className="t-12 t-muted" style={{ paddingBottom: 4 }}>
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const d = ymd(view.y, view.m, day);
          const on = d === date;
          const ok = allowed(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={dateLabel(d)}
              disabled={!ok}
              onClick={() => setDate(d)}
              style={{
                justifySelf: "center",
                width: 40,
                height: 40,
                borderRadius: 20,
                border: d === now && !on ? "1.5px solid var(--line-strong)" : 0,
                background: on ? "var(--accent)" : "none",
                color: on ? "#fff" : ok ? "var(--ink)" : "var(--disabled)",
                fontSize: 15,
                fontWeight: on ? 700 : 400,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* 시간 (마감처럼 날짜 + 시간이면) — 시간 휠과 같은 모양, 3줄만 */}
      {withTime ? (
        <div style={{ position: "relative", display: "flex", justifyContent: "center", gap: 24 }}>
          <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: ROW, height: ROW, background: "var(--bg)", borderRadius: 12 }} />
          <Wheel items={Array.from({ length: 24 }, (_, i) => i)} value={hour} onChange={setHour} label="시" format={pad} visible={3} />
          <span aria-hidden="true" style={{ alignSelf: "center", fontSize: 26, fontWeight: 600, zIndex: 1, marginInline: -12 }}>
            :
          </span>
          <Wheel items={[0, 30]} value={minute} onChange={setMinute} label="분" format={pad} visible={3} />
        </div>
      ) : null}

      <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={!allowed(date)} onClick={() => onConfirm(withTime ? `${date}T${pad(hour)}:${pad(minute)}` : date)}>
        {dateLabel(date)}
        {withTime ? ` ${pad(hour)}:${pad(minute)}` : ""} 확인
      </button>
    </Sheet>
  );
}
