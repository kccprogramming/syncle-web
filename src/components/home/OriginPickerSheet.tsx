"use client";

/**
 * 2 새 팀 만들기의 '주로 출발하는 곳' 고르기 시트.
 * 검색어를 넣으면 data.ts의 searchPlaces(카카오 로컬 API, 키가 없으면 가짜 데이터)로 장소를 찾고, 고르면 그림 지도에 핀과 주소를 보여줘요.
 * 실제 지도 API(카카오맵)를 붙일 때는 OriginMap 안쪽만 바꾸면 돼요 (lat/lng를 그대로 넘기면 돼요).
 * 시트를 열 때마다 새로 그려지도록, 부모에서 {open && <OriginPickerSheet ... />}처럼 써요.
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { checkOrigin, searchPlaces } from "@/lib/data";
import type { PlaceSearchResult } from "@/types";

export function OriginPickerSheet({
  initial,
  onClose,
  onPick,
}: {
  initial: PlaceSearchResult | null;
  onClose: () => void;
  onPick: (place: PlaceSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PlaceSearchResult | null>(initial);
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [retry, setRetry] = useState(0);
  // 고른 곳으로 이동시간을 계산할 수 있는지 (주소가 동네까지만 있으면 안 돼요)
  const [usable, setUsable] = useState<"checking" | "ok" | "no">("ok");
  useEffect(() => {
    if (!picked) return;
    let gone = false;
    setUsable("checking");
    checkOrigin(picked).then((ok) => !gone && setUsable(ok ? "ok" : "no"));
    return () => {
      gone = true;
    };
  }, [picked]);

  // 입력을 멈추고 0.25초 뒤에 찾아요. 새로 입력하면 이전 요청은 취소해요.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setStatus("done");
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setStatus("error");
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, retry]);

  return (
    <Sheet open onClose={onClose} title="주로 출발하는 곳" sub="역이나 건물 이름으로 찾아요. 팀원에게는 동네까지만 보여요">
      <div className="hstack gap-8" style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, color: "var(--muted)", display: "inline-flex" }}>
          <Icon name="search" size={18} />
        </span>
        <input
          className="input"
          type="search"
          autoFocus={!initial}
          placeholder="예: 대화역, 신촌역"
          aria-label="출발지 검색"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPicked(null);
          }}
          style={{ paddingLeft: 40 }}
        />
      </div>

      {picked ? (
        <>
          <OriginMap place={picked} />
          <div className="stack gap-4">
            <span className="t-15 t-bold">{picked.name}</span>
            <span className="t-13 t-ink2">{picked.roadAddress}</span>
            <span className="t-12 t-muted">팀원에게는 ‘{picked.area}’까지만 보여요</span>
          </div>
          {usable === "no" ? (
            <span role="alert" className="t-13 t-warn" style={{ lineHeight: 1.5 }}>
              이 곳은 위치를 하나로 정할 수 없어서 이동시간을 계산할 수 없어요 · 역은 ‘구로역 1호선’처럼 노선이 붙은 것을, 아니면 번지가 있는 건물을 골라 주세요
            </span>
          ) : null}
          <button type="button" className="btn btn--primary btn--lg btn--block" disabled={usable !== "ok"} onClick={() => onPick(picked)}>
            {usable === "checking" ? "위치 확인 중…" : "여기서 출발해요"}
          </button>
        </>
      ) : (
        <ul className="stack" style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 300, overflowY: "auto" }}>
          {status === "idle" ? (
            <li className="t-13 t-muted" style={{ padding: "12px 2px" }}>장소 이름이나 주소를 입력해 주세요</li>
          ) : status === "loading" && results.length === 0 ? (
            <li className="t-13 t-muted" style={{ padding: "12px 2px" }} aria-live="polite">찾는 중이에요…</li>
          ) : status === "error" ? (
            <li className="hstack gap-8" style={{ padding: "12px 2px", justifyContent: "space-between" }} aria-live="polite">
              <span className="t-13 t-warn">검색이 잠시 안 돼요</span>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setRetry((n) => n + 1)}>
                다시 찾기
              </button>
            </li>
          ) : results.length === 0 ? (
            <li className="stack gap-4" style={{ padding: "12px 2px" }}>
              <span className="t-14 t-strong">‘{query}’ 검색 결과가 없어요</span>
              <span className="t-12 t-muted">역·학교·건물 이름이나 도로명(예: 정릉로 77)으로 찾아보세요</span>
            </li>
          ) : (
            results.map((r) => (
              <li key={r.id} style={{ borderBottom: "1px solid var(--line-2)" }}>
                <button
                  type="button"
                  onClick={() => setPicked(r)}
                  className="hstack gap-10"
                  style={{ width: "100%", minHeight: 56, padding: "8px 2px", border: 0, background: "none", textAlign: "left" }}
                >
                  <span style={{ color: "var(--accent)", display: "inline-flex", flexShrink: 0 }}>
                    <Icon name="pin" size={18} />
                  </span>
                  <span className="stack gap-2" style={{ minWidth: 0 }}>
                    <span className="t-14 t-strong t-ellipsis">{r.name}</span>
                    <span className="t-12 t-muted t-ellipsis">{r.roadAddress}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </Sheet>
  );
}

/**
 * 고른 장소를 가운데 핀으로 보여주는 그림 지도 (6 장소 후보의 PlaceMap과 같은 느낌).
 * 카카오맵을 붙이면 new kakao.maps.LatLng(place.lat, place.lng)로 가운데를 맞추면 돼요.
 */
export function OriginMap({ place, height = 132 }: { place: PlaceSearchResult; height?: number }) {
  const road = "var(--line-2)";
  return (
    <div
      role="img"
      aria-label={`${place.name} 위치 지도`}
      style={{ height, borderRadius: "var(--radius)", background: "var(--line)", position: "relative", overflow: "hidden", flexShrink: 0 }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, top: "58%", height: 10, background: road }} />
      <div style={{ position: "absolute", left: "30%", top: 0, bottom: 0, width: 8, background: road, transform: "rotate(14deg)" }} />
      <div style={{ position: "absolute", left: "72%", top: 0, bottom: 0, width: 10, background: road }} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <span className="t-12 t-strong" style={{ padding: "4px 8px", borderRadius: "var(--radius-s)", background: "var(--ink)", color: "var(--surface)", whiteSpace: "nowrap" }}>
          {place.name}
        </span>
        <span style={{ color: "var(--accent)", display: "inline-flex" }}>
          <Icon name="pin" size={30} strokeWidth={2.4} />
        </span>
      </div>
    </div>
  );
}
