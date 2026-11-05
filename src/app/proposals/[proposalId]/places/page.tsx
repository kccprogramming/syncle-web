"use client";

/**
 * 6 장소 후보 — 지도 + 정렬 + 장소 카드 3개. 고르면 제안에 반영해요.
 * '공평한 순'은 D 모듈(rankPlacesByFairness)과 같은 기준이에요:
 * 가장 오래 걸리는 사람의 이동시간 → 같으면 사람 간 차이(최장−최단) → 같으면 맞는 선호 조건 수.
 */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { useDemo } from "@/lib/demo-store";
import { getPlaces, getProposal } from "@/lib/data";
import type { PlaceOption } from "@/types";
import { PlaceMap } from "@/components/meeting/PlaceMap";
import { walkMinutes } from "@/components/meeting/proposal-utils";

/** 정렬 방법과 설명 */
const SORTS = [
  { id: "fair", label: "공평한 순", note: "가장 오래 걸리는 사람이 짧은 순 · 같으면 사람 간 차이가 작은 순" },
  { id: "near", label: "가까운 순", note: "역에서 걸어가는 시간이 짧은 순" },
] as const;

/** 사람 간 이동시간 차이 (가장 오래 − 가장 짧게 걸리는 사람, D의 travelTimeDifference) */
function diffMinutes(p: PlaceOption) {
  const m = p.travel.map((t) => t.minutes);
  return Math.max(...m) - Math.min(...m);
}
type SortId = (typeof SORTS)[number]["id"];

function sortPlaces(list: PlaceOption[], sort: SortId) {
  const copy = [...list];
  if (sort === "fair") copy.sort((a, b) => a.maxMinutes - b.maxMinutes || diffMinutes(a) - diffMinutes(b));
  if (sort === "near") copy.sort((a, b) => walkMinutes(a.walk) - walkMinutes(b.walk));
  return copy;
}

export default function PlacesPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const router = useRouter();
  const { state, update } = useDemo();

  const proposal = getProposal(proposalId);
  const data = getPlaces(proposal.id);
  const [selId, setSelId] = useState(state.placeId);
  const [sort, setSort] = useState<SortId>("fair");

  const places = sortPlaces(data.places, sort);
  const selected = data.places.find((p) => p.id === selId) ?? data.places[0];
  const sortNote = SORTS.find((s) => s.id === sort)?.note;

  function choose() {
    update({ placeId: selected.id });
    router.push(`/proposals/${proposal.id}`);
  }

  return (
    <main className="screen">
      <TopBar back={`/proposals/${proposal.id}`} backLabel="회의 제안으로" title="장소 후보" right={<span className="t-12 t-muted no-shrink" style={{ marginRight: 8 }}>{data.timeLabel}</span>} />

      <PlaceMap places={data.places} selectedId={selId} areaLabel={data.areaLabel} onPick={setSelId} />

      <div className="screen__body" style={{ padding: "12px 16px", gap: 10 }}>
        <h1 className="no-shrink" style={{ fontSize: 16, fontWeight: 700 }}>
          {data.title}
        </h1>

        <div className="hstack gap-6 no-shrink" role="group" aria-label="정렬">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sort === s.id}
              onClick={() => setSort(s.id)}
              className={`chip${sort === s.id ? " chip--on" : ""}`}
              style={{ minHeight: 30, padding: "0 10px", fontSize: 12, borderRadius: 14 }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="t-12 t-muted no-shrink">{sortNote}</span>

        <div role="radiogroup" aria-label="장소 고르기" className="stack" style={{ gap: 10 }}>
          {places.map((p) => (
            <PlaceCard key={p.id} place={p} on={p.id === selId} onPick={() => setSelId(p.id)} />
          ))}
        </div>
      </div>

      <footer className="footer" style={{ padding: "10px 16px 18px", gap: 6 }}>
        <button type="button" className="btn btn--primary" onClick={choose}>
          {selected.short}로 정하기
        </button>
        <span className="t-12 t-muted t-center">시설·인원·예약은 확정 뒤 회의 카드에서 장소 사이트로 확인해요</span>
      </footer>
    </main>
  );
}

/** 장소 카드 하나: 이름, 최장 이동시간, 사람별 이동시간, 공평한 이유 */
function PlaceCard({ place, on, onPick }: { place: PlaceOption; on: boolean; onPick: () => void }) {
  // 가장 오래 걸리는 사람이 맨 앞
  const travel = [...place.travel].sort((a, b) => b.minutes - a.minutes);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={`option${on ? " option--on" : ""}`}
      style={{ flexDirection: "column", alignItems: "stretch", gap: 6, padding: "12px 14px", borderRadius: 14, flexShrink: 0, color: "var(--ink)" }}
    >
      <span className="hstack gap-8">
        <span
          className="avatar"
          style={{
            width: 22,
            height: 22,
            fontSize: 11,
            fontWeight: 700,
            background: on ? "var(--accent)" : "var(--surface)",
            color: on ? "#fff" : "var(--ink)",
            border: `1.5px solid ${on ? "var(--accent)" : "var(--ink)"}`,
          }}
        >
          {place.label}
        </span>
        <span className="t-15 t-strong grow">{place.name}</span>
        <span className="t-13 t-bold" style={{ color: on ? "var(--accent)" : "var(--ink-2)" }}>
          최장 {place.maxMinutes}분
        </span>
      </span>
      <span className="t-12 t-muted">
        {place.walk} · 사람 간 차이 {diffMinutes(place)}분
      </span>
      <span className="hstack gap-6" style={{ flexWrap: "wrap" }}>
        {travel.map((t, i) => {
          const longest = i === 0;
          return (
            <span
              key={t.who}
              className="t-12"
              style={{
                padding: "2px 7px",
                borderRadius: 6,
                background: longest ? (on ? "#DDE2FB" : "#E9EBF0") : "var(--line-2)",
                color: longest ? (on ? "var(--accent-ink)" : "var(--ink)") : "var(--ink-2)",
                fontWeight: longest ? 700 : 400,
              }}
            >
              {t.who} {t.minutes}분
            </span>
          );
        })}
      </span>
      <span className="t-12" style={{ lineHeight: 1.5, color: on ? "var(--accent-ink)" : "var(--muted)" }}>
        {place.reason}
      </span>
    </button>
  );
}
