"use client";

/**
 * 6 장소 후보 — 지도 + 정렬 + 장소 카드. 고르면 제안에 반영해요.
 *
 * 장소는 data.ts의 recommendPlaces → 서버 /api/places/recommend → D 모듈(findPlaces)로 찾아요.
 * 카카오 키가 없으면 서버가 가짜 데이터를 돌려줘요 (화면 위에 '예시 데이터'로 표시).
 *
 * '공평한 순'은 D의 rankPlacesByFairness와 같은 기준이에요:
 * 가장 오래 걸리는 사람의 이동시간 → 같으면 사람 간 차이(최장−최단) → 같으면 맞는 선호 조건 수.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { Spinner } from "@/components/Icon";
import { useDemo } from "@/lib/demo-store";
import { getProposal, recommendPlaces, type PlaceRecommendation } from "@/lib/data";
import type { PlaceOption, PlaceSearchResult } from "@/types";
import { PlaceMap } from "@/components/meeting/PlaceMap";
import { walkMinutes } from "@/components/meeting/proposal-utils";

/** 정렬 방법과 설명 */
const SORTS = [
  { id: "fair", label: "공평한 순", note: "가장 오래 걸리는 사람이 짧은 순 · 같으면 사람 간 차이가 작은 순" },
  { id: "near", label: "가까운 순", note: "역에서 걸어가는 시간이 짧은 순" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

/** 사람 간 이동시간 차이. D가 준 값이 있으면 그 값, 없으면 직접 계산 (모르는 사람이 있으면 null) */
function diffOf(p: PlaceOption): number | null {
  if (p.diffMinutes !== undefined) return p.diffMinutes;
  const m = p.travel.map((t) => t.minutes);
  if (m.some((x) => x === null)) return null;
  const known = m as number[];
  return Math.max(...known) - Math.min(...known);
}

/** 모르는 값(null)은 맨 뒤로 */
const nullLast = (v: number | null | undefined) => (v === null || v === undefined ? Number.MAX_SAFE_INTEGER : v);

function sortPlaces(list: PlaceOption[], sort: SortId) {
  const copy = [...list];
  if (sort === "fair") copy.sort((a, b) => nullLast(a.maxMinutes) - nullLast(b.maxMinutes) || nullLast(diffOf(a)) - nullLast(diffOf(b)));
  if (sort === "near") copy.sort((a, b) => walkMinutes(a.walk) - walkMinutes(b.walk));
  return copy;
}

/** D에 보낼 내 출발지: 역 이름이면 이름 그대로, 아니면 도로명 주소 (D resolveOrigin이 역/주소를 나눠서 찾아요) */
function originForD(o: PlaceSearchResult | null): string | undefined {
  if (!o) return undefined;
  return /역(\s+\S+선)?$/.test(o.name) ? o.name : o.roadAddress;
}

export default function PlacesPage() {
  const { proposalId } = useParams<{ proposalId: string }>();
  const router = useRouter();
  const { state, update } = useDemo();
  const proposal = getProposal(proposalId);

  const [data, setData] = useState<PlaceRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selId, setSelId] = useState(state.placeId);
  const [sort, setSort] = useState<SortId>("fair");

  // 장소 추천 불러오기 (내 출발지가 바뀌면 다시)
  const myOrigin = originForD(state.origin);
  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError(null);
    recommendPlaces(proposal.id, myOrigin, ctrl.signal)
      .then((d) => {
        setData(d);
        // 전에 고른 장소가 목록에 없으면 1위 장소를 골라 둬요
        setSelId((cur) => (d.places.some((p) => p.id === cur) ? cur : (sortPlaces(d.places, "fair")[0]?.id ?? cur)));
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setError((e as Error).message || "장소를 찾지 못했어요");
      });
    return () => ctrl.abort();
  }, [proposal.id, myOrigin, retry]);

  const live = data?.source === "kakao";
  const sorts = live ? SORTS.filter((s) => s.id === "fair") : SORTS; // 실제 결과에는 도보 시간이 없어서 '가까운 순'은 숨겨요
  const places = data ? sortPlaces(data.places, sort) : [];
  const selected = places.find((p) => p.id === selId) ?? places[0];
  const sortNote = SORTS.find((s) => s.id === sort)?.note;

  function choose() {
    if (!selected) return;
    update({ placeId: selected.id, chosenPlace: live ? selected : null });
    router.push(`/proposals/${proposal.id}`);
  }

  return (
    <main className="screen">
      <TopBar
        back={`/proposals/${proposal.id}`}
        backLabel="회의 제안으로"
        title="장소 후보"
        right={<span className="t-12 t-muted no-shrink" style={{ marginRight: 8 }}>{data?.timeLabel ?? ""}</span>}
      />

      {data && places.length ? (
        <PlaceMap places={places} selectedId={selected?.id ?? ""} areaLabel={data.areaLabel} onPick={setSelId} />
      ) : (
        <div className="no-shrink" style={{ height: 140, background: "var(--line)" }} aria-hidden="true" />
      )}

      <div className="screen__body" style={{ padding: "12px 16px", gap: 10 }}>
        {error ? (
          <div role="alert" className="card stack gap-8" style={{ padding: 14 }}>
            <span className="t-15 t-strong">장소를 찾지 못했어요</span>
            <span className="t-13 t-muted">{error}</span>
            <button type="button" className="btn btn--ghost" style={{ height: 40, alignSelf: "flex-start", padding: "0 14px" }} onClick={() => setRetry((n) => n + 1)}>
              다시 찾기
            </button>
          </div>
        ) : !data ? (
          <div role="status" className="card stack gap-10" style={{ padding: 14 }}>
            <div className="hstack gap-10">
              <Spinner size={18} />
              <span className="t-14 t-strong">장소와 팀원별 이동시간을 찾고 있어요</span>
            </div>
            <span className="t-12 t-muted">카카오 장소 검색 → 팀원 출발지 확인 → 대중교통 시간 계산 · 보통 5초 안에 끝나요</span>
            <div className="pulse stack gap-6" aria-hidden="true">
              <div style={{ height: 64, borderRadius: 12, background: "var(--line-2)" }} />
              <div style={{ height: 64, borderRadius: 12, background: "var(--line-2)" }} />
            </div>
          </div>
        ) : (
          <>
            <div className="hstack gap-8 no-shrink">
              <h1 className="grow" style={{ fontSize: 16, fontWeight: 700 }}>
                {data.title}
              </h1>
              {live ? null : <span className="tag tag--gray no-shrink">예시 데이터</span>}
            </div>

            {sorts.length > 1 ? (
              <div className="hstack gap-6 no-shrink" role="group" aria-label="정렬">
                {sorts.map((s) => (
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
            ) : null}
            <span className="t-12 t-muted no-shrink">{sortNote}</span>

            {places.length === 0 ? (
              <div className="card" style={{ padding: 14 }}>
                <span className="t-14 t-ink2">조건에 맞는 장소가 없어요. 검색 지역을 바꿔서 다시 찾아볼 수 있어요.</span>
              </div>
            ) : (
              <div role="radiogroup" aria-label="장소 고르기" className="stack" style={{ gap: 10 }}>
                {places.map((p) => (
                  <PlaceCard key={p.id} place={p} on={p.id === selected?.id} onPick={() => setSelId(p.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <footer className="footer" style={{ padding: "10px 16px 18px", gap: 6 }}>
        <button type="button" className="btn btn--primary" onClick={choose} disabled={!selected}>
          {selected ? `${selected.short}로 정하기` : "장소 고르기"}
        </button>
        <span className="t-12 t-muted t-center">
          {data?.unverified ? "시설·수용 인원은 아직 확인 전이에요 · 확정 뒤 장소 사이트에서 확인해요" : "시설·인원·예약은 확정 뒤 회의 카드에서 장소 사이트로 확인해요"}
        </span>
      </footer>
    </main>
  );
}

/** 장소 카드 하나: 이름, 최장 이동시간, 사람별 이동시간, 공평한 이유 */
function PlaceCard({ place, on, onPick }: { place: PlaceOption; on: boolean; onPick: () => void }) {
  // 가장 오래 걸리는 사람이 맨 앞, 모르는 사람은 맨 뒤
  const travel = [...place.travel].sort((a, b) => (b.minutes ?? -1) - (a.minutes ?? -1));
  const diff = diffOf(place);
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
            flexShrink: 0,
          }}
        >
          {place.label}
        </span>
        <span className="t-15 t-strong grow t-ellipsis" style={{ minWidth: 0 }}>
          {place.name}
        </span>
        <span className="t-13 t-bold no-shrink" style={{ color: on ? "var(--accent)" : "var(--ink-2)" }}>
          {place.maxMinutes === null ? "순위 없음" : `최장 ${place.maxMinutes}분`}
        </span>
      </span>
      <span className="t-12 t-muted t-ellipsis">
        {place.walk}
        {diff === null ? "" : ` · 사람 간 차이 ${diff}분`}
      </span>
      <span className="hstack gap-6" style={{ flexWrap: "wrap" }}>
        {travel.map((t, i) => {
          const longest = i === 0 && t.minutes !== null;
          return (
            <span
              key={t.who}
              className="t-12"
              style={{
                padding: "2px 7px",
                borderRadius: 6,
                background: longest ? (on ? "#DDE2FB" : "#E9EBF0") : "var(--line-2)",
                color: t.minutes === null ? "var(--warn)" : longest ? (on ? "var(--accent-ink)" : "var(--ink)") : "var(--ink-2)",
                fontWeight: longest ? 700 : 400,
              }}
            >
              {t.who} {t.minutes === null ? "미확인" : `${t.minutes}분`}
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
