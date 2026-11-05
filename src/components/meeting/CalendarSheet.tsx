"use client";

/**
 * 8 회의 카드의 '캘린더 추가' 시트.
 * - Google 캘린더에 추가: 로그인된 Google 계정의 캘린더가 새 탭으로 열려요 (저장만 누르면 돼요)
 * - 다른 캘린더 앱: .ics 파일을 받아 아이폰 · 아웃룩 캘린더 등에서 열어요
 */
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { downloadIcs, googleCalendarUrl, type IcsEvent } from "./ics";

export function CalendarSheet({ event, fileName, onClose }: { event: IcsEvent; fileName: string; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title="캘린더에 추가" sub="로그인된 Google 계정 캘린더가 새 탭으로 열려요 · 저장을 눌러 주세요">
      <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className="btn btn--primary" style={{ height: 50 }} onClick={onClose}>
        Google 캘린더에 추가
        <Icon name="external" size={16} strokeWidth={2.2} />
      </a>
      <button
        type="button"
        className="btn btn--ghost"
        style={{ height: 46, border: "1px solid var(--line)", fontSize: 14 }}
        onClick={() => {
          downloadIcs(event, fileName);
          onClose();
        }}
      >
        다른 캘린더 앱 (.ics 파일 받기)
      </button>
    </Sheet>
  );
}
