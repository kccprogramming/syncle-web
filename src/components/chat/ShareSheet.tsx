"use client";

/**
 * 4 + 메뉴 (자료 공유) 시트 — 사진 · 파일 · 할 일 · AI로 회의 잡기
 * 사진 · 파일은 기기에서 고르면 onPickFile로 넘겨요 (대화방이 팀 자료에 올려요).
 */
import { useRef } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";

/** 어느 버튼으로 올리는지 */
export type UploadKind = "photo" | "file";

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
  onPickFile,
  uploading = null,
}: {
  open: boolean;
  onClose: () => void;
  /** 'AI로 회의 잡기' */
  onAiMeeting: () => void;
  /** @AI 안내 줄 */
  onAiHelp: () => void;
  /** 아직 없는 기능 */
  onSoon: () => void;
  /** 사진 · 파일을 골랐을 때 (어느 버튼으로 골랐는지 같이 넘겨요) */
  onPickFile: (file: File, kind: UploadKind) => void;
  /** 올리는 중인 버튼. 그 버튼만 '올리는 중…'으로 바뀌고 잠겨요 */
  uploading?: UploadKind | null;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tile = (icon: IconName, label: string, onClick: () => void, disabled = false) => (
    <button type="button" style={{ ...tileStyle, opacity: disabled ? 0.5 : 1 }} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={22} />
      {label}
    </button>
  );
  const picked = (kind: UploadKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = ""; // 같은 파일을 다시 골라도 올라가게
    if (file) onPickFile(file, kind);
  };

  return (
    <Sheet open={open} onClose={onClose} label="더보기 메뉴">
      <span className="t-15 t-strong" style={{ marginTop: -4 }}>
        공유하기
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: -4 }}>
        {tile("image", uploading === "photo" ? "올리는 중…" : "사진", () => photoRef.current?.click(), uploading === "photo")}
        {tile("file", uploading === "file" ? "올리는 중…" : "파일", () => fileRef.current?.click(), uploading === "file")}
        {tile("task", "할 일", onSoon)}
        {tile("calendarAdd", "AI로 회의 잡기", onAiMeeting)}
      </div>
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={picked("photo")} />
      <input ref={fileRef} type="file" hidden onChange={picked("file")} />
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
