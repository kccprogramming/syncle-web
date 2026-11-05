"use client";

/** 대화방 위 요약 줄 (회의 · 할 일). 누르면 팀 메뉴가 열리고, 확정된 회의면 회의 카드로 가요. */
import Link from "next/link";
import { Icon } from "@/components/Icon";

const barStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "var(--surface)",
  borderTop: "1px solid var(--line)",
  borderBottom: "1px solid var(--line)",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 13,
  color: "var(--ink)",
  flexShrink: 0,
  width: "100%",
  textAlign: "left",
  borderLeft: 0,
  borderRight: 0,
};

function Line({ icon, label, text, confirmed }: { icon: "clock" | "check"; label: string; text: string; confirmed?: boolean }) {
  return (
    <span className="hstack gap-8" style={{ minWidth: 0 }}>
      <Icon name={icon} size={15} strokeWidth={2} color="var(--accent)" />
      <span className="t-muted no-shrink">{label}</span>
      <span className="t-ellipsis">{text}</span>
      {confirmed ? <span className="tag tag--ok no-shrink">확정</span> : null}
    </span>
  );
}

export function SummaryBar({
  meetingText,
  confirmedHref,
  taskText,
  onOpen,
}: {
  meetingText: string | null;
  /** 확정된 회의가 있으면 그 회의 카드 주소 */
  confirmedHref: string | null;
  taskText: string | null;
  onOpen: () => void;
}) {
  if (!meetingText && !taskText) return null;
  const lines = (
    <>
      {meetingText ? <Line icon="clock" label="회의" text={meetingText} confirmed={!!confirmedHref} /> : null}
      {taskText ? <Line icon="check" label="할 일" text={taskText} /> : null}
    </>
  );
  if (confirmedHref) {
    return (
      <Link href={confirmedHref} style={barStyle}>
        {lines}
      </Link>
    );
  }
  return (
    <button type="button" style={barStyle} onClick={onOpen}>
      {lines}
    </button>
  );
}
