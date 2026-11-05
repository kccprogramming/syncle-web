import assert from 'node:assert/strict';
import type { KakaoErrorDetail } from './kakaoApiError.ts';

type DepartureInput = {
  startAt: string;
  arrivalBufferMinutes: number;
  memberId: string;
  minutes: number | null;
  status: 'ok' | 'unknown' | 'error';
  checkedAt: string | null;
  error?: KakaoErrorDetail;
  travelTimeBasis?: 'api_estimate_without_meeting_time' | null;
};

function parseStartAt(value: string): number {
  const match = typeof value === 'string'
    ? /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
    : null;
  if (!match) return NaN;
  const local = new Date(`${match[1]}Z`);
  if (!Number.isFinite(local.getTime()) || local.toISOString().slice(0, 19) !== match[1]) return NaN;
  return Date.parse(value);
}

export function recommendDepartureTime(input: DepartureInput) {
  const { memberId, minutes, status, checkedAt, startAt, arrivalBufferMinutes, travelTimeBasis = null } = input;
  const hasTravelTime = status === 'ok' && minutes !== null && Number.isSafeInteger(minutes) && minutes >= 0;
  const base = { memberId, minutes: hasTravelTime ? minutes : null, checkedAt, travelTimeBasis };
  if (status === 'error') {
    return {
      ...base,
      status: 'error' as const,
      recommendedDepartureAt: null,
      reason: 'travel_time_lookup_failed' as const,
      ...(input.error ? { error: input.error } : {}),
    };
  }
  const unknown = (reason: 'invalid_start_at' | 'invalid_arrival_buffer' | 'travel_time_unavailable' | 'departure_out_of_range') =>
    ({ ...base, status: 'unknown' as const, recommendedDepartureAt: null, reason });

  const meetingTime = parseStartAt(startAt);
  if (!Number.isFinite(meetingTime)) return unknown('invalid_start_at');
  if (!Number.isSafeInteger(arrivalBufferMinutes) || arrivalBufferMinutes < 0) return unknown('invalid_arrival_buffer');
  if (!hasTravelTime) return unknown('travel_time_unavailable');

  const seoulOffsetMs = 9 * 60 * 60 * 1000;
  const departure = new Date(meetingTime - (minutes + arrivalBufferMinutes) * 60_000 + seoulOffsetMs);
  if (!Number.isFinite(departure.getTime()) || departure.getUTCFullYear() < 1 || departure.getUTCFullYear() > 9999) {
    return unknown('departure_out_of_range');
  }
  return {
    ...base,
    status: 'ok' as const,
    recommendedDepartureAt: departure.toISOString().replace('Z', '+09:00'),
  };
}
