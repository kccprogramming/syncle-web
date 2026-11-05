/** 상단 바 오른쪽의 상태 표시 (초안 / 확정 / 조율 필요) */
const tones = {
  gray: { background: "var(--line-2)", color: "var(--muted)", fontWeight: 500 },
  ok: { background: "var(--ok-bg)", color: "var(--ok)", fontWeight: 600 },
  warn: { background: "var(--warn-bg)", color: "var(--warn)", fontWeight: 600 },
};

export function StatusPill({ tone, children }: { tone: keyof typeof tones; children: React.ReactNode }) {
  return (
    <span className="t-12 no-shrink" style={{ ...tones[tone], borderRadius: 10, padding: "2px 8px", marginRight: 8 }}>
      {children}
    </span>
  );
}
