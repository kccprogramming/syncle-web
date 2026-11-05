/**
 * 지우(C)가 D의 rankPlacesByFairness를 팀 추천 기준(11/5)으로 고친 복사본.
 * 1시간 제한 → 이동시간 차이 → 최장 이동시간 순. D 브랜치에 같은 기준이 들어오면 D 함수로 바꿔요.
 * 원본: just_keeping share/jiwoo-c-code a9c6fb0 integration/syncle-web/src/server/vendor/d/rankPlacesByFairness.ts
 */
type PlaceInput = {
  placeId: string;
  travelTimes: readonly { minutes: number | null }[];
  matchedPreferredConditionCount: number;
};

type Fairness = {
  maxTravelMinutes: number | null;
  travelTimeDifference: number | null;
  rank: number | null;
  recommendationReason: string;
};

type RankedCandidate = {
  placeId: string;
  preferenceCount: number;
  maximum: number;
  difference: number;
  result: Fairness;
};

/** Shared ranking for all searched regions. The caller sets the maximum travel time. */
export function rankPlacesByFairness<T extends PlaceInput>(places: readonly T[], travelLimitMinutes = Infinity): (T & Fairness)[] {
  const candidates: RankedCandidate[] = [];
  const results = places.map((place) => {
    const result: T & Fairness = {
      ...place,
      maxTravelMinutes: null,
      travelTimeDifference: null,
      rank: null,
      recommendationReason: '구성원이 2명 이상이어야 공평성 순위를 계산할 수 있습니다.',
    };
    if (place.travelTimes.length < 2) return result;

    let minimum = Infinity;
    let maximum = 0;
    for (const { minutes } of place.travelTimes) {
      if (minutes === null || !Number.isSafeInteger(minutes) || minutes < 0) {
        result.recommendationReason = '일부 구성원의 유효한 이동시간이 없어 공평성 순위를 계산할 수 없습니다.';
        return result;
      }
      minimum = Math.min(minimum, minutes);
      maximum = Math.max(maximum, minutes);
    }

    const difference = maximum - minimum;
    result.maxTravelMinutes = maximum;
    result.travelTimeDifference = difference;
    if (maximum > travelLimitMinutes) {
      result.recommendationReason = `최장 이동시간 ${maximum}분으로 제한 ${travelLimitMinutes}분을 초과합니다.`;
      return result;
    }
    candidates.push({
      placeId: place.placeId,
      preferenceCount: place.matchedPreferredConditionCount,
      maximum,
      difference,
      result,
    });
    return result;
  });

  candidates.sort((left, right) =>
    left.difference - right.difference ||
    left.maximum - right.maximum ||
    right.preferenceCount - left.preferenceCount ||
    (left.placeId < right.placeId ? -1 : Number(left.placeId > right.placeId)),
  );
  candidates.forEach(({ result, maximum, difference, preferenceCount }, index) => {
    result.rank = index + 1;
    result.recommendationReason =
      `이동시간 차이 ${difference}분을 우선 비교한 결과 ${result.rank}위입니다. 최장 이동시간은 ${maximum}분이고 확인된 선호 조건은 ${preferenceCount}개입니다.`;
  });
  return results;
}
