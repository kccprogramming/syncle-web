/**
 * 6 장소 후보 위의 간단한 지도 (도형으로 그린 그림 지도).
 * 실제 지도 API를 붙이기 전까지는 길 몇 개 + 역 이름 + A/B/C 핀만 보여줘요.
 * 핀 위치는 데이터의 pin.x / pin.y (지도 영역 안의 %)를 써요.
 */
import type { PlaceOption } from "@/types";

const road = "#F7F8FA";

export function PlaceMap({
  places,
  selectedId,
  areaLabel,
  onPick,
}: {
  places: PlaceOption[];
  selectedId: string;
  areaLabel: string;
  onPick: (id: string) => void;
}) {
  return (
    <div style={{ height: 140, background: "#E6EAF0", position: "relative", overflow: "hidden", flexShrink: 0 }}>
      {/* 길 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 74, height: 10, background: road }} />
      <div style={{ position: "absolute", left: "46%", top: 0, width: 10, height: 140, background: road }} />
      <div style={{ position: "absolute", left: 60, top: 10, width: 8, height: 130, background: road, transform: "rotate(18deg)" }} />
      {/* 기준 역 */}
      <div className="t-12 t-strong" style={{ position: "absolute", left: "41%", top: 62, padding: "4px 8px", borderRadius: 8, background: "var(--ink)", color: "#fff" }}>
        {areaLabel}
      </div>
      {/* 장소 핀 */}
      {places.map((p) => {
        const on = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            aria-label={`${p.short} 고르기`}
            aria-pressed={on}
            onClick={() => onPick(p.id)}
            style={{
              position: "absolute",
              left: `${p.pin.x}%`,
              top: `${p.pin.y}%`,
              transform: "translate(-50%, -50%)",
              width: 30,
              height: 30,
              padding: 0,
              borderRadius: 15,
              border: `2px solid ${on ? "#fff" : "var(--ink)"}`,
              background: on ? "var(--accent)" : "#fff",
              color: on ? "#fff" : "var(--ink)",
              boxShadow: on ? "0 2px 8px rgba(51, 70, 211, 0.4)" : "none",
              fontSize: 13,
              fontWeight: 700,
              zIndex: on ? 2 : 1,
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
