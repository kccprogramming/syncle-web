"use client";

/**
 * 시간 고르기 휠 시트 — 시 · 분 두 줄을 위아래로 굴려 가운데 줄을 고르고 '확인'.
 * 브라우저 기본 시간 입력(오전/오후) 대신 "15 : 00"처럼 24시간으로 바로 보이게 하려고 만들었어요 (제안 만들기 · 회의 가능 시간).
 * value / onConfirm 은 "HH:mm" (24시간).
 */
import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/Sheet";

export const ROW = 48; // 한 줄 높이
const VISIBLE = 5; // 보이는 줄 수 (가운데가 선택)

/** 한 줄 휠 — 날짜 시트(DatePickerSheet)에서도 써요. visible: 보이는 줄 수(홀수) */
export function Wheel({
  items,
  value,
  onChange,
  label,
  format,
  visible = VISIBLE,
}: {
  items: number[];
  value: number;
  onChange: (v: number) => void;
  label: string;
  format: (v: number) => string;
  visible?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, items.indexOf(value));

  // 처음 열 때 고른 값이 가운데 오게
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ROW;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const i = Math.min(items.length - 1, Math.max(0, Math.round(top / ROW)));
          if (items[i] !== value) onChange(items[i]);
        }, 80);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const i = Math.min(items.length - 1, Math.max(0, index + (e.key === "ArrowDown" ? 1 : -1)));
        ref.current?.scrollTo({ top: i * ROW, behavior: "smooth" });
      }}
      style={{
        height: ROW * visible,
        width: 88,
        overflowY: "auto",
        scrollSnapType: "y mandatory",
        scrollbarWidth: "none",
        position: "relative",
        zIndex: 1,
        outline: "none",
      }}
    >
      <div style={{ height: ROW * Math.floor(visible / 2) }} />
      {items.map((v, i) => {
        const d = Math.abs(i - index);
        return (
          <button
            key={v}
            type="button"
            role="option"
            aria-selected={v === value}
            onClick={() => ref.current?.scrollTo({ top: i * ROW, behavior: "smooth" })}
            style={{
              display: "block",
              width: "100%",
              height: ROW,
              border: 0,
              background: "none",
              scrollSnapAlign: "center",
              fontSize: d === 0 ? 26 : 22,
              fontWeight: d === 0 ? 600 : 400,
              color: d === 0 ? "var(--ink)" : d === 1 ? "var(--muted)" : "var(--disabled)",
              fontVariantNumeric: "tabular-nums",
              transition: "font-size .12s, color .12s",
            }}
          >
            {format(v)}
          </button>
        );
      })}
      <div style={{ height: ROW * Math.floor(visible / 2) }} />
    </div>
  );
}

export function TimeWheelSheet({
  title,
  value,
  hours,
  minutes = [0, 30],
  onClose,
  onConfirm,
}: {
  title: string;
  /** "HH:mm" */
  value: string;
  /** 고를 수 있는 시 (예: 6~23) */
  hours: number[];
  minutes?: number[];
  onClose: () => void;
  onConfirm: (hhmm: string) => void;
}) {
  // 고를 수 없는 시(범위 밖)로 열리면 가장 가까운 시로 맞춰요
  const [h, setH] = useState(() => {
    const v = Number(value.slice(0, 2));
    return hours.includes(v) ? v : hours.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), hours[0] ?? v);
  });
  const [m, setM] = useState(Number(value.slice(3, 5)));
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <Sheet open onClose={onClose} title={title}>
      <div style={{ position: "relative", display: "flex", justifyContent: "center", gap: 24 }}>
        {/* 가운데 선택 줄 */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: 0, right: 0, top: ROW * Math.floor(VISIBLE / 2), height: ROW, background: "var(--bg)", borderRadius: 12 }}
        />
        <Wheel items={hours} value={h} onChange={setH} label="시" format={pad} />
        <span aria-hidden="true" style={{ alignSelf: "center", fontSize: 26, fontWeight: 600, zIndex: 1, marginInline: -12 }}>
          :
        </span>
        <Wheel items={minutes} value={m} onChange={setM} label="분" format={pad} />
      </div>
      <button type="button" className="btn btn--primary" style={{ height: 50 }} onClick={() => onConfirm(`${pad(h)}:${pad(m)}`)}>
        확인
      </button>
    </Sheet>
  );
}
