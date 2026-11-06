/** AI 시간 보정. 외부 호출 없이 테스트할 수 있는 순수 함수. */
/** 2026-11-09T23:59:59+09:00 같은 시각 (초 · 소수초 · 시간대 포함) */
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** 시각 글자 하나를 분 단위로 맞춰요. 시각이 아니거나 이미 맞으면 그대로 돌려줘요 */
export function roundToMinute(value: string): string {
  const m = TIMESTAMP.exec(value);
  if (!m) return value;
  const [, y, mo, d, h, mi, s, frac, zone] = m;
  const seconds = Number(s) + (frac ? Number(frac) : 0);
  if (seconds === 0 && !frac) return value;
  // 시간대 그대로 두고 '벽시계' 시각만 계산해요
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) + (seconds >= 59 ? 60_000 : 0);
  const t = new Date(wall).toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  return `${t}:00${zone}`;
}

/** JSON 안의 모든 시각 글자를 다듬어요 */
function roundAll(value: unknown): unknown {
  if (typeof value === "string") return roundToMinute(value);
  if (Array.isArray(value)) return value.map(roundAll);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, roundAll(v)]));
  return value;
}

/** 회의 조건(B Conditions) 모양이면 origins에 빠진 팀원을 { station: null }로 채워요 */
function fillOrigins(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const c = value as { origins?: unknown; schedule?: { members?: unknown } };
  const members = c.schedule?.members;
  if (!Array.isArray(members) || (c.origins !== undefined && !Array.isArray(c.origins))) return value;
  const origins = (c.origins ?? []) as { memberId?: unknown }[];
  const have = new Set(origins.map((o) => o?.memberId));
  const missing = members
    .map((m) => (m as { memberId?: unknown })?.memberId)
    .filter((id): id is string => typeof id === "string" && !have.has(id))
    .map((memberId) => ({ memberId, station: null }));
  return missing.length ? { ...c, origins: [...origins, ...missing] } : value;
}

type Slot = { startAt: string; endAt: string };
const isSlot = (s: unknown): s is Slot =>
  !!s && typeof (s as Slot).startAt === "string" && typeof (s as Slot).endAt === "string" &&
  Number.isFinite(Date.parse((s as Slot).startAt)) && Number.isFinite(Date.parse((s as Slot).endAt));

/** 되는 시간에서 안 되는 시간과 겹치는 부분을 빼요. 경계 글자는 원래 글자를 그대로 써요 */
function subtract(available: Slot[], unavailable: Slot[]): Slot[] {
  let pieces = available;
  for (const no of unavailable) {
    const ns = Date.parse(no.startAt), ne = Date.parse(no.endAt);
    pieces = pieces.flatMap((a) => {
      const as = Date.parse(a.startAt), ae = Date.parse(a.endAt);
      if (!(as < ne && ns < ae)) return [a]; // 안 겹쳐요
      const out: Slot[] = [];
      if (as < ns) out.push({ startAt: a.startAt, endAt: no.startAt });
      if (ne < ae) out.push({ startAt: no.endAt, endAt: a.endAt });
      return out;
    });
  }
  return pieces;
}

/** 구간을 기간 안으로 잘라요. 다 잘려 나가면 null */
function clip(s: Slot, w: Slot): Slot | null {
  const start = Date.parse(s.startAt) < Date.parse(w.startAt) ? w.startAt : s.startAt;
  const end = Date.parse(s.endAt) > Date.parse(w.endAt) ? w.endAt : s.endAt;
  return Date.parse(start) < Date.parse(end) ? { startAt: start, endAt: end } : null;
}

/** 회의 조건 모양이면 팀원마다 시간 구간을 찾는 기간 안으로 잘라요 */
function clipToWindow(value: unknown): unknown {
  const c = value as { schedule?: { members?: unknown; searchWindow?: unknown } } | null;
  const members = c?.schedule?.members;
  const w = c?.schedule?.searchWindow;
  if (!Array.isArray(members) || !isSlot(w)) return value;
  const fix = (list: unknown) =>
    Array.isArray(list) && list.every(isSlot) ? list.map((s) => clip(s, w)).filter((s): s is Slot => s !== null) : list;
  const fixed = members.map((m) => {
    if (!m || typeof m !== "object") return m;
    const x = m as Record<string, unknown>;
    return {
      ...x,
      availableSlots: fix(x.availableSlots),
      unavailableSlots: fix(x.unavailableSlots),
      ...(x.preferredSlots !== undefined ? { preferredSlots: fix(x.preferredSlots) } : {}),
    };
  });
  return { ...(c as object), schedule: { ...(c!.schedule as object), members: fixed } };
}

/** 회의 조건 모양이면 팀원마다 겹치는 되는 시간을 정리해요 */
function dropConflicts(value: unknown): unknown {
  const c = value as { schedule?: { members?: unknown } } | null;
  const members = c?.schedule?.members;
  if (!Array.isArray(members)) return value;
  const fixed = members.map((m) => {
    const av = (m as { availableSlots?: unknown })?.availableSlots;
    const un = (m as { unavailableSlots?: unknown })?.unavailableSlots;
    if (!Array.isArray(av) || !Array.isArray(un) || !av.every(isSlot) || !un.every(isSlot) || !un.length) return m;
    return { ...(m as object), availableSlots: subtract(av, un) };
  });
  return { ...(c as object), schedule: { ...(c!.schedule as object), members: fixed } };
}

/** 기존 보정 순서를 유지한다. 가능 여부나 새로운 시각을 추측하지 않는다. */
export function normalizeScheduleOutput(value: unknown): unknown {
  return dropConflicts(clipToWindow(fillOrigins(roundAll(value))));
}

/** 원문·주소·시각·팀원 ID 없이, 보정 전후의 슬롯 수와 총 분량만 기록한다. */
export function scheduleTimeSummary(value: unknown) {
  const members = (value as { schedule?: { members?: unknown } } | null)?.schedule?.members;
  if (!Array.isArray(members)) return [];
  return members.map((member, index) => {
    const m = member as { availableSlots?: unknown; unavailableSlots?: unknown } | null;
    const stats = (slots: unknown) => {
      if (!Array.isArray(slots)) return { count: 0, minutes: 0 };
      const valid = slots.filter(isSlot);
      return { count: valid.length, minutes: valid.reduce((sum, s) => sum + Math.max(0, Date.parse(s.endAt) - Date.parse(s.startAt)) / 60000, 0) };
    };
    return { index, available: stats(m?.availableSlots), unavailable: stats(m?.unavailableSlots) };
  });
}
