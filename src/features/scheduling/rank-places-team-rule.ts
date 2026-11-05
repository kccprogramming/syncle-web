/**
 * 지우(C)가 D의 rankPlacesByFairness를 팀 추천 기준(11/5)으로 고친 복사본.
 * 1시간 제한 → 이동시간 차이 → 최장 이동시간 순. D 브랜치에 같은 기준이 들어오면 D 함수로 바꿔요.
 * 11/6 밤 (앱 통합본에서 고침, 지우님께 공유): 출발지가 없는 팀원 한 명 때문에 모든 장소가 순위에서 빠져서,
 * 이동시간을 모르는 사람은 빼고 아는 사람(2명 이상)끼리 비교해요. 모르는 사람이 적은 장소가 먼저예요.
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
  unknownCount: number;
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

    const known = place.travelTimes
      .map(({ minutes }) => minutes)
      .filter((minutes): minutes is number => minutes !== null && Number.isSafeInteger(minutes) && minutes >= 0);
    const unknownCount = place.travelTimes.length - known.length;
    if (known.length < 2) {
      result.recommendationReason = '이동시간을 아는 구성원이 2명 미만이라 공평성 순위를 계산할 수 없습니다.';
      return result;
    }
    const minimum = Math.min(...known);
    const maximum = Math.max(...known);

    const difference = maximum - minimum;
    result.maxTravelMinutes = maximum;
    result.travelTimeDifference = difference;
    if (maximum > travelLimitMinutes) {
      result.recommendationReason = `최장 이동시간 ${maximum}분으로 제한 ${travelLimitMinutes}분을 초과합니다.`;
      return result;
    }
    candidates.push({
      placeId: place.placeId,
      unknownCount,
      preferenceCount: place.matchedPreferredConditionCount,
      maximum,
      difference,
      result,
    });
    return result;
  });

  candidates.sort((left, right) =>
    left.unknownCount - right.unknownCount ||
    left.difference - right.difference ||
    left.maximum - right.maximum ||
    right.preferenceCount - left.preferenceCount ||
    (left.placeId < right.placeId ? -1 : Number(left.placeId > right.placeId)),
  );
  candidates.forEach(({ result, maximum, difference, preferenceCount, unknownCount }, index) => {
    result.rank = index + 1;
    result.recommendationReason =
      `이동시간 차이 ${difference}분을 우선 비교한 결과 ${result.rank}위입니다. 최장 이동시간은 ${maximum}분이고 확인된 선호 조건은 ${preferenceCount}개입니다.` +
      (unknownCount ? ` 이동시간을 모르는 ${unknownCount}명은 빼고 계산했습니다.` : '');
  });
  return results;
}
