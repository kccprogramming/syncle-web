import assert from 'node:assert/strict';

const defaultMaxTravelMinutesLimit = 60;

type PlaceInput = {
  placeId: string;
  travelTimes: readonly { minutes: number | null }[];
  matchedPreferredConditionCount: number;
};

type Fairness = {
  maxTravelMinutes: number | null;
  travelTimeDifference: number | null;
  rank: number | null;
  rankExclusionReason?: 'insufficient_members' | 'travel_time_unavailable' | 'max_travel_time_exceeded';
  recommendationReason: string;
};

type RankedCandidate = {
  placeId: string;
  preferenceCount: number;
  maximum: number;
  difference: number;
  result: Fairness;
};

export function rankPlacesByFairness<T extends PlaceInput>(
  places: readonly T[], maxTravelMinutesLimit = defaultMaxTravelMinutesLimit,
): (T & Fairness)[] {
  if (!Number.isSafeInteger(maxTravelMinutesLimit) || maxTravelMinutesLimit < 0) {
    throw new RangeError('최대 이동시간 제한은 0 이상의 정수여야 합니다.');
  }
  const candidates: RankedCandidate[] = [];
  const results = places.map((place) => {
    const result: T & Fairness = {
      ...place,
      maxTravelMinutes: null,
      travelTimeDifference: null,
      rank: null,
      recommendationReason: '구성원이 2명 이상이어야 공평성 순위를 계산할 수 있습니다.',
    };
    let minimum = Infinity;
    let maximum = 0;
    for (const { minutes } of place.travelTimes) {
      if (minutes === null || !Number.isSafeInteger(minutes) || minutes < 0) {
        result.rankExclusionReason = 'travel_time_unavailable';
        result.recommendationReason = '일부 구성원의 유효한 이동시간이 없어 공평성 순위를 계산할 수 없습니다.';
        return result;
      }
      minimum = Math.min(minimum, minutes);
      maximum = Math.max(maximum, minutes);
    }

    if (place.travelTimes.length < 2) {
      result.rankExclusionReason = 'insufficient_members';
      return result;
    }

    const difference = maximum - minimum;
    result.maxTravelMinutes = maximum;
    result.travelTimeDifference = difference;
    if (maximum > maxTravelMinutesLimit) {
      result.rankExclusionReason = 'max_travel_time_exceeded';
      result.recommendationReason = `최장 이동시간 ${maximum}분이 제한 ${maxTravelMinutesLimit}분을 초과했습니다.`;
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
      `전원이 ${maxTravelMinutesLimit}분 이내이며, 이동시간 차이 ${difference}분을 우선 비교한 결과 ${result.rank}위입니다. 최장 이동시간은 ${maximum}분이고 확인된 선호 조건은 ${preferenceCount}개입니다.`;
  });
  return results;
}
