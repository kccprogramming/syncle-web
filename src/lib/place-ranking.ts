/**
 * 장소 추천 기준 (팀 합의, 2026-11-05)
 *
 * 1. 누군가의 이동시간이 최대 이동시간 제한(MAX_TRAVEL_MINUTES)을 넘는 장소는 뺀다.
 * 2. 남은 장소는 팀원 간 이동시간 차이(가장 오래 − 가장 짧게)가 작은 순으로 추천한다.
 * 3. 차이가 같으면 가장 오래 걸리는 사람의 이동시간이 짧은 곳을 먼저 둔다.
 *
 * 이동시간을 확인하지 못한 팀원이 있는 장소는 제한을 넘는지 알 수 없어서 순위 없이 맨 뒤에 둬요.
 * 실제 결과(D)와 예시 데이터 모두 이 함수로 순위와 추천 이유를 만들어요.
 * (D 모듈의 rankPlacesByFairness는 예전 기준인 '가장 먼 사람 우선'이라 여기서 다시 매겨요)
 */
import type { PlaceOption } from "@/types";

/** 최대 이동시간 제한 (분). 이보다 오래 걸리는 사람이 있으면 그 장소는 추천하지 않아요 */
export const MAX_TRAVEL_MINUTES = 60;

export const RANKING_NOTE = `${MAX_TRAVEL_MINUTES / 60}시간 넘게 걸리는 사람이 있는 곳은 빼고, 팀원 간 이동시간 차이가 작은 순`;

type Stats = { max: number; min: number; diff: number };

function stats(p: PlaceOption): Stats | null {
  const m = p.travel.map((t) => t.minutes);
  if (m.length === 0 || m.some((x) => x === null)) return null;
  const known = m as number[];
  const max = Math.max(...known);
  const min = Math.min(...known);
  return { max, min, diff: max - min };
}

export interface RankedPlaces {
  /** 순위가 매겨진 장소 + 순위를 못 매긴 장소(맨 뒤) */
  places: PlaceOption[];
  /** 제한을 넘어서 뺀 장소 */
  excluded: PlaceOption[];
}

export function rankPlaces(list: PlaceOption[], limit = MAX_TRAVEL_MINUTES): RankedPlaces {
  const scored = list.map((p) => ({ p, s: stats(p) }));
  const excluded = scored.filter(({ s }) => s && s.max > limit).map(({ p, s }) => withReason(p, null, s, null, limit));
  const ok = scored.filter((x): x is { p: PlaceOption; s: Stats } => !!x.s && x.s.max <= limit);
  ok.sort((a, b) => a.s.diff - b.s.diff || a.s.max - b.s.max || a.p.name.localeCompare(b.p.name, "ko"));
  const best = ok[0]?.s ?? null;
  const ranked = ok.map(({ p, s }, i) => withReason(p, i + 1, s, best, limit));
  const unknown = scored.filter(({ s }) => !s).map(({ p }) => withReason(p, null, null, null, limit));
  return { places: [...ranked, ...unknown], excluded };
}

function withReason(p: PlaceOption, rank: number | null, s: Stats | null, best: Stats | null, limit: number): PlaceOption {
  return { ...p, rank, maxMinutes: s?.max ?? null, diffMinutes: s?.diff ?? null, reason: reasonFor(p, rank, s, best, limit) };
}

function reasonFor(p: PlaceOption, rank: number | null, s: Stats | null, best: Stats | null, limit: number): string {
  if (!s) {
    const who = p.travel.filter((t) => t.minutes === null).map((t) => t.who);
    return who.length ? `${who.join(", ")}님의 이동시간을 확인하지 못해 순위에서 뺐어요` : "이동시간을 확인하지 못해 순위에서 뺐어요";
  }
  if (rank === null) {
    const far = p.travel.filter((t) => (t.minutes ?? 0) > limit).map((t) => `${t.who} ${t.minutes}분`);
    return `${far.join(", ")}으로 ${limit}분을 넘어서 뺐어요`;
  }
  const range = `모두 ${s.min}~${s.max}분`;
  if (rank === 1 || !best) return `${range} · 사람 간 차이 ${s.diff}분으로 가장 고르게 걸려요`;
  if (s.diff === best.diff && s.max === best.max) return `${range} · 1위와 이동시간이 똑같아요`;
  if (s.diff === best.diff) return `${range} · 1위와 차이(${s.diff}분)는 같지만 가장 먼 사람이 ${s.max - best.max}분 더 걸려요`;
  return `${range} · 사람 간 차이 ${s.diff}분으로 1위보다 ${s.diff - best.diff}분 더 벌어져요`;
}

/** 지역끼리 비교: 각 지역의 1위 장소를 같은 기준으로 비교해요 */
export function compareAreas(a: PlaceOption | undefined, b: PlaceOption | undefined): number {
  const da = a?.diffMinutes ?? Infinity;
  const db = b?.diffMinutes ?? Infinity;
  if (da !== db) return da - db;
  return (a?.maxMinutes ?? Infinity) - (b?.maxMinutes ?? Infinity);
}
