"use client";

/**
 * 대화방 아래 입력줄: + 버튼, 글 입력칸, 보내기.
 * 비어 있을 때 보이는 안내 글의 '@AI'를 누르면 onCallAi가 불려요 (AI 도움말 패널 열기).
 */
import { forwardRef } from "react";
import { Icon } from "@/components/Icon";

export const Composer = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onCallAi: () => void;
    onSend: () => void;
    onPlus: () => void;
    /** 위에 도움말 패널이 붙어 있으면 위쪽 줄을 없애요 */
    joined?: boolean;
  }
>(function Composer({ value, onChange, onCallAi, onSend, onPlus, joined }, ref) {
  return (
    <form
      className="composer"
      style={joined ? { borderTop: 0 } : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <button type="button" className="composer__plus" aria-label="자료 공유 메뉴 열기" onClick={onPlus}>
        <Icon name="plus" size={20} strokeWidth={2.2} />
      </button>
      <div className="grow" style={{ position: "relative" }}>
        <input
          ref={ref}
          id="composer-input"
          className="composer__input"
          style={{ width: "100%" }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="메시지 입력"
          autoComplete="off"
        />
        {/* 비어 있을 때 보이는 안내 글. 눌러도 입력칸이 선택되고, '@AI'를 누르면 AI를 불러요. */}
        {value === "" ? (
          <label
            htmlFor="composer-input"
            className="t-14"
            style={{ position: "absolute", left: 15, top: 0, bottom: 0, right: 12, display: "flex", alignItems: "center", color: "var(--faint)", whiteSpace: "nowrap", overflow: "hidden", cursor: "text" }}
          >
            <button
              type="button"
              className="t-accent t-strong"
              aria-label="@AI 입력하고 AI 도움말 열기"
              // 입력칸 포커스는 onCallAi에서 옮겨요
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCallAi}
              style={{ border: 0, background: "none", padding: "0 3px 0 0", font: "inherit", cursor: "pointer" }}
            >
              @AI
            </button>
            로 AI 부르기
          </label>
        ) : null}
      </div>
      <button type="submit" className="composer__send" disabled={value.trim() === ""}>
        <Icon name="send" size={18} strokeWidth={2} />
        {/* 눈에는 안 보이고 스크린리더가 읽는 버튼 이름 */}
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}>보내기</span>
      </button>
    </form>
  );
});
