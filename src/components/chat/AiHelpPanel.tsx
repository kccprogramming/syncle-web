"use client";

/** 3-1 입력줄 위에 뜨는 'AI 부르기 도움말' 패널 */
import { AiAvatar } from "@/components/Logo";

/** 누르면 입력줄에 채워지는 부탁 예시 */
export const AI_CHIPS = [
  { label: "회의 잡아줘", text: "@AI 회의 잡아줘" },
  { label: "오늘 대화 요약해줘", text: "@AI 오늘 대화 요약해줘" },
  { label: "할 일 정리해줘", text: "@AI 할 일 정리해줘" },
  { label: "공유된 자료 모아줘", text: "@AI 공유된 자료 모아줘" },
  { label: "회의록 정리해줘", text: "@AI 회의록 정리해줘" },
];

export function AiHelpPanel({ onPick }: { onPick: (text: string) => void }) {
  return (
    <section
      aria-label="AI 부르기 도움말"
      className="stack gap-12 no-shrink"
      style={{ background: "var(--surface)", borderTop: "1px solid var(--line)", borderRadius: "16px 16px 0 0", padding: "14px 16px 12px" }}
    >
      <div className="hstack gap-10">
        <AiAvatar size={36} />
        <div className="stack" style={{ gap: 1 }}>
          <span className="t-14 t-strong">
            싱클 AI <span className="t-accent" style={{ fontWeight: 500 }}>@AI</span>
          </span>
          <span className="t-12 t-muted">이 대화방의 대화와 자료를 읽고 도와줘요</span>
        </div>
      </div>
      <span className="t-12 t-muted">이렇게 부탁해 보세요</span>
      <div className="hstack gap-8" style={{ flexWrap: "wrap" }}>
        {AI_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            className="chip"
            style={{ padding: "0 12px" }}
            // 입력칸 포커스가 빠지지 않게 마우스를 누를 때 기본 동작을 막아요
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c.text)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </section>
  );
}
