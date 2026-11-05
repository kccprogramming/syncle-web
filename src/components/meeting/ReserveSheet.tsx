"use client";

/** 8-1 예약하기 시트: 예약 정보를 보여주고 네이버 예약으로 보내요. 예약 자체는 네이버에서 끝나요. */
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import type { PlaceOption } from "@/types";

// 장소 시설 정보
// TODO: API 연결 시 data.ts로 옮기기
const FACILITIES: Record<string, string> = { A: "모니터 · 화이트보드", B: "화이트보드", C: "모니터" };

function InfoRow({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className="hstack gap-12" style={{ alignItems: "flex-start", padding: "10px 0", borderBottom: last ? 0 : "1px solid var(--line-2)" }}>
      <span className="t-13 t-muted no-shrink" style={{ width: 64 }}>
        {label}
      </span>
      <div className="stack gap-2">{children}</div>
    </div>
  );
}

export function ReserveSheet({
  onClose,
  place,
  timeLabel,
  people,
  booker,
}: {
  onClose: () => void;
  place: PlaceOption;
  timeLabel: string;
  people: number;
  booker: string;
}) {
  // "스터디룸 A · 6인실" → "6인실"
  const room = place.name.split(" · ")[1] ?? place.name;
  const naverUrl = `https://map.naver.com/p/search/${encodeURIComponent(place.name)}`;
  const facilities = FACILITIES[place.id];

  return (
    <Sheet open onClose={onClose} label="예약하기">
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>예약하기</h2>

      <div className="hstack gap-12">
        <span className="avatar" style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", color: "#fff", fontSize: 17, fontWeight: 700 }}>
          {place.label}
        </span>
        <div className="stack grow" style={{ gap: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{place.name}</span>
          <span className="t-12 t-muted">
            {place.walk}
            {facilities ? ` · ${facilities}` : ""}
          </span>
        </div>
        <span className="t-12 t-ink2 no-shrink" style={{ background: "var(--line-2)", borderRadius: 8, padding: "3px 8px" }}>
          네이버 예약
        </span>
      </div>

      <div className="stack" style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "4px 14px" }}>
        <InfoRow label="날짜·시간">
          <span className="t-14 t-strong">{timeLabel}</span>
          <span className="t-12 t-ok">확정된 시간</span>
        </InfoRow>
        <InfoRow label="인원">
          <span className="t-14 t-strong">{people}명</span>
        </InfoRow>
        <InfoRow label="예약자">
          <span className="t-14 t-strong">{booker}</span>
        </InfoRow>
        <InfoRow label="이용" last>
          <span className="t-14 t-strong">{room} · 2시간</span>
          <span className="t-12 t-muted">요금은 네이버 예약 화면에서 확인해요</span>
        </InfoRow>
      </div>

      <p className="t-12 t-muted" style={{ lineHeight: 1.55 }}>
        예약은 네이버 예약에서 진행되고, 그곳에서 마무리돼요. 위 날짜·시간·인원을 확인하고 똑같이 선택해 주세요.
      </p>

      <div className="stack gap-8">
        <a href={naverUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--lg">
          네이버 예약으로 이동
          <Icon name="external" size={16} strokeWidth={2.2} />
        </a>
        <button type="button" className="btn" style={{ height: 44, background: "none", color: "var(--ink)", fontWeight: 400 }} onClick={onClose}>
          취소
        </button>
      </div>
    </Sheet>
  );
}
