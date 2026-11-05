/** 대면 / 온라인 전환 버튼 (회의 제안 목적 카드) */
export function ModeToggle({ mode, onChange }: { mode: "offline" | "online"; onChange: (m: "offline" | "online") => void }) {
  const items = [
    { id: "offline", label: "대면" },
    { id: "online", label: "온라인" },
  ] as const;
  return (
    <div role="group" aria-label="회의 방식" className="hstack no-shrink" style={{ background: "var(--line-2)", borderRadius: 8, padding: 2 }}>
      {items.map((it) => {
        const on = mode === it.id;
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(it.id)}
            className="t-12"
            style={{
              height: 28,
              padding: "0 12px",
              border: 0,
              borderRadius: 6,
              fontWeight: 600,
              background: on ? "var(--surface)" : "transparent",
              color: on ? "var(--ink)" : "var(--muted)",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
