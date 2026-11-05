"use client";

/** 4 + 메뉴 (자료 공유) 시트 */
import { Icon, type IconName } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";

const tileStyle: React.CSSProperties = {
  height: 76,
  border: 0,
  borderRadius: 12,
  background: "var(--bg)",
  color: "var(--ink)",
  fontSize: 13,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

export function ShareSheet({
  open,
  onClose,
  onAiMeeting,
  onAiHelp,
  onSoon,
}: {
  open: boolean;
  onClose: () => void;
  /** 'AI로 회의 잡기' */
  onAiMeeting: () => void;
  /** @AI 안내 줄 */
  onAiHelp: () => void;
  /** 아직 없는 기능 */
  onSoon: () => void;
}) {
  const tile = (icon: IconName, label: string) => (
    <button type="button" style={tileStyle} onClick={onSoon}>
      <Icon name={icon} size={22} />
      {label}
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} label="더보기 메뉴">
      <span className="t-15 t-strong" style={{ marginTop: -4 }}>
        공유하기
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: -4 }}>
        {tile("image", "사진")}
        {tile("file", "파일")}
        {tile("poll", "투표 만들기")}
        {tile("task", "할 일")}
        <button
          type="button"
          onClick={onAiMeeting}
          style={{ ...tileStyle, border: "1.5px solid var(--accent-line)", background: "var(--accent-softer)", color: "var(--accent-strong)", fontWeight: 600 }}
        >
          <Icon name="calendarAdd" size={22} />
          AI로 회의 잡기
        </button>
        {tile("link", "링크")}
      </div>
      <button
        type="button"
        onClick={onAiHelp}
        className="hstack gap-10"
        style={{ background: "var(--accent-softer)", borderRadius: 12, padding: "12px 14px", border: 0, textAlign: "left", marginTop: -4 }}
      >
        <span className="t-13 t-bold no-shrink" style={{ color: "var(--accent-strong)", background: "var(--accent-soft)", borderRadius: 6, padding: "2px 6px" }}>
          @AI
        </span>
        <span className="t-13 t-ink2" style={{ lineHeight: 1.45 }}>
          AI는 메시지에 @AI를 붙여 불러요. 회의 잡기, 대화 요약, 할 일 정리를 부탁할 수 있어요.
        </span>
      </button>
      <button type="button" className="btn btn--ghost btn--block" style={{ borderColor: "var(--line)", marginTop: -4 }} onClick={onClose}>
        닫기
      </button>
    </Sheet>
  );
}
