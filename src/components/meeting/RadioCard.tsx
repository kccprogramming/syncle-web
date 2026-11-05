import { Radio } from "@/components/Controls";

/**
 * 하나만 고르는 카드 (5-3 대안, 8-2 어떻게 할까요).
 * on이면 파란 테두리 + 연한 배경으로 바뀌어요.
 */
export function RadioCard({
  on,
  onClick,
  title,
  badge,
  lines,
  big = false,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  badge?: string;
  lines: { text: string; className?: string }[];
  /** true면 화면 카드처럼 크게 (흰 배경, 둥근 14px) */
  big?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`option${on ? " option--on" : ""}`}
      style={{
        alignItems: "flex-start",
        gap: 12,
        padding: big ? "14px 16px" : "12px 14px",
        borderRadius: big ? 14 : 12,
        background: big ? "var(--surface)" : undefined,
        flexShrink: 0,
      }}
    >
      <span style={{ display: "flex", marginTop: 2 }}>
        <Radio on={on} />
      </span>
      <span className="stack grow" style={{ gap: big ? 3 : 2 }}>
        <span className="hstack gap-6">
          <span className={big ? "t-15 t-strong" : "t-14 t-strong"}>{title}</span>
          {badge ? <span className="tag tag--accent">{badge}</span> : null}
        </span>
        {lines.map((l) => (
          <span key={l.text} className={l.className ?? "t-12 t-muted"}>
            {l.text}
          </span>
        ))}
      </span>
    </button>
  );
}
