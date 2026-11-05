'use client';

/**
 * 실제 회의 제안 화면 (C · 지우) — 5 회의 제안과 같은 모양으로 다시 그렸어요 (11/6 희원).
 *
 * 기능 · 규칙은 지우님 원본 그대로예요:
 * - 바꾸는 요청(respond · condition · mode · remind · places · confirm)은 모두 action()으로 보내고 항상 지금 version을 넣어요
 * - 응답은 /respond (selected · declined_all · custom)
 * - 장소는 고른 timeOptionId + searchAreas로 /places, 확정은 그 결과(placeResults)의 장소 ID로 /confirm
 * 화면 원칙: 한 화면 · 주 버튼 하나 · 자세한 건 시트/펼치기로.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Toast, useToast } from '@/components/Toast';
import { ModeToggle } from '@/components/meeting/ModeToggle';
import { RadioCard } from '@/components/meeting/RadioCard';
import { StatusPill } from '@/components/meeting/StatusPill';
import { AreaPickerSheet } from './AreaPickerSheet';
import { DatePickerSheet, dateLabel } from '@/components/DatePickerSheet';
import { CheckBox } from '@/components/Controls';
import { getMember, loadTeamMembers, seoulLabel } from '@/lib/data';
import { schedulingRequest, suggestPlaceSearch, type LiveProposal } from '@/lib/scheduling-client';

type Action = 'respond' | 'condition' | 'mode' | 'remind' | 'places' | 'confirm';

/** "11/11(수) 19:00–20:00" */
const timeLabel = (start: string, end: string) => `${seoulLabel(start)}–${seoulLabel(end).slice(-5)}`;
/** 날짜 + 시각 칸 값 → 서울 시간 */
const toKst = (value: string) => (value.length === 16 ? value + ':00+09:00' : value);
const safeUrl = (value: string | null | undefined) => {
  try {
    const u = new URL(value ?? '');
    return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
};
const nameOf = (id: string) => {
  const n = getMember(id).name;
  return n === '?' ? '팀원' : n;
};

export function LiveProposal({ proposalId }: { proposalId: string }) {
  const toast = useToast();
  const [data, setData] = useState<LiveProposal | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(''); // 확정 · 장소를 볼 시간 후보
  const [placeId, setPlaceId] = useState('');
  const [sheet, setSheet] = useState<null | 'time' | 'confirm' | 'areas' | 'other' | 'link'>(null);
  // 내 응답: 시간 카드를 누르면 바로 체크되고 잠시 뒤 저장돼요
  const [picks, setPicks] = useState<string[]>([]);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const dataRef = useRef<LiveProposal | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const chosenTouched = useRef(false); // 방장이 확정할 시간을 직접 바꿨는지
  const [areasText, setAreasText] = useState('');
  // 찾을 장소: 비워 두면 C가 저장된 B 장소 종류(conditions.placeType)로 찾아요. 방장이 바꾼 경우에만 보내요
  const [keyword, setKeyword] = useState('');
  const [areaNote, setAreaNote] = useState('');
  const [, setNamesReady] = useState(0);

  const load = useCallback(async () => {
    try {
      const p = await schedulingRequest<LiveProposal>(`proposals/${proposalId}`);
      setData(p);
      setError('');
      return p;
    } catch (e) {
      setError(e instanceof Error ? e.message : '제안을 읽지 못했어요.');
      return null;
    }
  }, [proposalId]);
  useEffect(() => {
    void load();
  }, [load]);

  // 팀원 이름 (응답 · 이동시간 · 방장 표시)
  useEffect(() => {
    if (!data) return;
    loadTeamMembers(data.memberIds).then(() => setNamesReady((v) => v + 1)).catch(() => undefined);
  }, [data?.memberIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새 데이터가 오면: 확정할 시간은 '된다고 한 사람이 가장 많은 시간'(같으면 앞쪽). 방장이 직접 바꿨으면 그대로
  useEffect(() => {
    dataRef.current = data;
    if (!data) return;
    const best = data.candidates.reduce<(typeof data.candidates)[number] | undefined>(
      (b, c) => (!b || c.explicitAvailableMemberIds.length > b.explicitAvailableMemberIds.length ? c : b),
      undefined,
    );
    setChosen((prev) => (chosenTouched.current && data.candidates.some((c) => c.id === prev) ? prev : (best?.id ?? '')));
    // 내 응답 체크 표시를 저장된 값으로 (저장 중이면 화면 값 그대로)
    if (!inFlight.current && !saveTimer.current) {
      const mineNow = data.responses.find((r) => r.memberId === data.viewerId);
      setPicks(mineNow?.kind === 'selected' ? mineNow.selectedCandidateIds : []);
    }
  }, [data]);
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);
  // 확정할 시간이 바뀌면 고른 장소는 지워요 (장소는 시간마다 따로 찾아요)
  useEffect(() => {
    setPlaceId('');
  }, [chosen]);

  // 응답 마감이 지나면 한 번 새로 불러와요 (응답한 사람 기준으로 다시 계산)
  useEffect(() => {
    if (!data || data.meeting) return;
    const ms = Date.parse(data.responseDeadline) - Date.now();
    if (ms < 0 || ms > 2147483000) return;
    const timer = setTimeout(() => void load(), ms + 100);
    return () => clearTimeout(timer);
  }, [data, load]);

  // C를 바꾸는 요청은 모두 여기로 보내고, 항상 지금 제안의 version을 같이 넣어요 (다른 사람이 먼저 바꿨으면 C_STALE_VERSION → 다시 불러와요)
  async function action(name: Action, payload: Record<string, unknown>, message: string): Promise<boolean> {
    if (!data || busy) return false;
    setBusy(true);
    setError('');
    try {
      const next = await schedulingRequest<LiveProposal>(`proposals/${proposalId}/${name}`, { ...payload, version: data.version });
      setData(next);
      toast.show(name === 'remind' ? `${next.notifiedCount ?? 0}명에게 다시 알렸어요` : message);
      return true;
    } catch (e) {
      const m = e instanceof Error ? e.message : '요청을 처리하지 못했어요.';
      await load();
      setError(m);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** 시간 카드 누르기 → 체크를 바꾸고 0.6초 뒤 저장 (연달아 누르면 마지막 것만 저장해요) */
  function togglePick(id: string) {
    const d = dataRef.current;
    if (!d) return;
    if (Date.now() >= Date.parse(d.responseDeadline)) return toast.show('응답 마감이 지났어요');
    const next = picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id];
    setPicks(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!next.length) {
      setSaving('idle');
      return;
    }
    setSaving('saving');
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void saveSelected(next);
    }, 600);
  }
  async function saveSelected(ids: string[]) {
    if (inFlight.current) {
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void saveSelected(ids);
      }, 400);
      return;
    }
    const d = dataRef.current;
    if (!d) return;
    inFlight.current = true;
    try {
      // 바꾸는 요청이라 지금 version을 같이 보내요
      const next = await schedulingRequest<LiveProposal>(`proposals/${proposalId}/respond`, { kind: 'selected', selectedCandidateIds: ids, customSlots: [], version: d.version });
      inFlight.current = false;
      setData(next);
      setSaving('saved');
      setError('');
    } catch (e) {
      inFlight.current = false;
      setSaving('idle');
      setError(e instanceof Error ? e.message : '응답을 저장하지 못했어요');
      await load();
    }
  }

  const owner = !!data && data.viewerId === data.ownerId;
  const needAreas = !!data && owner && data.mode === 'offline' && !data.meeting;
  /** B가 대화를 보고 정해 C에 저장된 장소 종류 (온라인 · 미정 · 예전 제안이면 null) */
  const storedType = data?.conditions.placeType?.trim() || null;
  useEffect(() => {
    if (storedType) setKeyword((k) => k || storedType);
  }, [storedType]);
  // 방장이 대면 회의를 볼 때 '비교할 지역'(팀원 출발지 가운데 역 3곳)과 '찾을 장소'(대화로 고른 종류)를 미리 채워요
  useEffect(() => {
    if (!needAreas) return;
    let gone = false;
    suggestPlaceSearch(proposalId)
      .then((s) => {
        if (gone) return;
        setAreasText((t) => t || s.areas.join(', '));
        setKeyword((k) => k || s.keyword);
        setAreaNote(`팀원 출발지 가운데 역이에요${s.unknownCount ? ` · 출발지를 모르는 ${s.unknownCount}명은 빼고 계산` : ''}`);
      })
      .catch((e) => !gone && setAreaNote(e instanceof Error ? `${e.message} · 지역을 직접 입력해 주세요` : '지역을 직접 입력해 주세요'));
    return () => {
      gone = true;
    };
  }, [needAreas, proposalId]);

  if (!data) {
    return (
      <main className="screen">
        <TopBar back="/home" backLabel="홈으로" title="회의 제안" />
        <div className="screen__body" style={{ alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {error ? (
            <>
              <span className="t-14 t-warn t-center">{error}</span>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => void load()}>
                다시 불러오기
              </button>
            </>
          ) : (
            <span className="t-14 t-muted">불러오는 중…</span>
          )}
        </div>
      </main>
    );
  }

  const candidate = data.candidates.find((c) => c.id === chosen);
  const places = data.placeResults.find((r) => r.timeOptionId === chosen);
  const ranked = (places?.places ?? []).slice().sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  const available = candidate?.explicitAvailableMemberIds.length ?? 0;
  const closed = Date.now() >= Date.parse(data.responseDeadline);
  const mine = data.responses.find((r) => r.memberId === data.viewerId);
  const myStatus =
    saving === 'saving'
      ? '저장하는 중…'
      : mine?.kind === 'declined_all'
        ? '‘다 안 돼요’로 응답했어요'
        : mine?.kind === 'custom'
          ? `다른 시간 ${mine.customSlots.length}개로 응답했어요`
          : picks.length
            ? `${picks.length}개 시간이 된다고 저장했어요`
            : '되는 시간을 눌러 주세요 · 누르면 바로 저장돼요';
  const canConfirm = !!candidate && available > 0 && (data.mode === 'online' || !!placeId);
  const confirmBlock = !candidate
    ? '확정할 시간이 없어요'
    : available === 0
      ? '이 시간에 된다고 한 사람이 없어요 · 위에서 되는 시간을 눌러 주세요'
      : data.mode === 'offline' && !placeId
        ? ranked.some((p) => p.rank !== null)
          ? '장소 후보 중 하나를 골라 주세요'
          : ranked.length
            ? '고를 수 있는 장소가 없어요 · 모두 1시간을 넘거나 이동시간을 아는 팀원이 2명보다 적어요'
            : '‘이 시간의 장소 찾기’를 눌러 주세요'
        : '이제 확정할 수 있어요';
  const pct = data.totalCount ? (data.respondedCount / data.totalCount) * 100 : 0;
  const durationMin = data.conditions.schedule.durationMinutes;

  const confirm = () =>
    action('confirm', { timeCandidateId: chosen, placeId: data.mode === 'offline' ? placeId : null, acknowledgePartialAttendance: true }, '회의가 확정됐어요 · 대화방에 확정 카드를 남겼어요').then(
      (ok) => ok && setSheet(null),
    );

  return (
    <main className="screen">
      <TopBar
        back={`/teams/${data.teamId}`}
        backLabel="대화방으로"
        title="회의 제안"
        right={data.meeting ? <StatusPill tone="ok">확정</StatusPill> : <StatusPill tone="gray">응답 중</StatusPill>}
      />

      <div className="screen__body" style={{ padding: '12px 16px', gap: 10 }}>
        {error ? (
          <p role="alert" className="t-13 t-warn" style={{ background: 'var(--warn-bg)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>
            {error}
          </p>
        ) : null}

        {/* 목적 카드: 제목 · 방식 · 길이 · 마감 · 응답 수 */}
        <section className="card">
          <div className="stack gap-2">
            <h1 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.35 }}>{data.title}</h1>
            <div className="hstack gap-8" style={{ marginTop: 4 }}>
              {owner && !data.meeting ? (
                <ModeToggle mode={data.mode} onChange={(mode) => mode !== data.mode && void action('mode', { mode, meetingUrl: data.meetingUrl ?? '' }, mode === 'online' ? '온라인 회의로 바꿨어요' : '대면 회의로 바꿨어요')} />
              ) : (
                <span className="tag tag--soft">{data.mode === 'online' ? '온라인' : '대면'}</span>
              )}
              <span className="t-13 t-muted">{durationMin % 60 === 0 ? `${durationMin / 60}시간` : `${durationMin}분`}</span>
            </div>
          </div>
          {!data.meeting ? (
            <>
              <div className="divider" />
              <div className="hstack gap-8">
                <Icon name="timer" size={16} strokeWidth={2} color="var(--warn)" />
                <span className="t-14 t-strong">{closed ? '응답 마감됨' : `응답 마감 ${seoulLabel(data.responseDeadline)}`}</span>
                <span className="t-12 t-muted" style={{ marginLeft: 'auto' }}>
                  응답 {data.respondedCount}/{data.totalCount}명
                </span>
              </div>
              <div role="progressbar" aria-label="응답한 사람" aria-valuemin={0} aria-valuemax={data.totalCount} aria-valuenow={data.respondedCount} style={{ height: 6, borderRadius: 3, background: 'var(--line)' }}>
                <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: 'var(--accent)' }} />
              </div>
              {data.pendingIds.length ? (
                <div className="hstack gap-8">
                  <span className="t-12 t-muted grow">
                    {data.pendingIds.map(nameOf).join(', ')}님 응답 전{closed ? ' · 응답한 사람 기준으로 추천해요' : ''}
                  </span>
                  {owner && !closed ? (
                    <button type="button" className="btn btn--sm btn--ghost no-shrink" style={{ fontSize: 12 }} disabled={busy} onClick={() => void action('remind', {}, '')}>
                      다시 알림
                    </button>
                  ) : null}
                </div>
              ) : (
                <span className="t-12 t-muted">모두 응답했어요</span>
              )}
            </>
          ) : null}
        </section>

        {data.meeting ? (
          /* 확정된 회의 */
          <section className="card" style={{ border: '1.5px solid var(--ok)', gap: 8 }}>
            <span className="t-12 t-bold" style={{ color: '#fff', background: 'var(--ok)', borderRadius: 8, padding: '2px 8px', alignSelf: 'flex-start' }}>
              회의가 확정됐어요
            </span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{timeLabel(data.meeting.startAt, data.meeting.endAt)}</span>
            <span className="t-13 t-ink2">
              {data.meeting.mode === 'online' ? '온라인 회의' : (data.meeting.place?.name ?? '장소 미정')} · 참석 {data.meeting.attendeeIds.length}명
            </span>
            {/* 주 버튼은 회의 카드 하나, 바깥으로 나가는 링크는 아래에 같은 크기의 보조 버튼으로 (세로로 쌓아요) */}
            <div className="stack gap-8" style={{ marginTop: 4 }}>
              <Link className="btn btn--primary" style={{ height: 48 }} href={`/meetings/${data.id}`}>
                회의 카드 보기
              </Link>
              {safeUrl(data.meeting.place?.url) ? (
                <a className="btn btn--ghost" style={{ height: 44, border: '1px solid var(--line)', fontSize: 14 }} href={safeUrl(data.meeting.place?.url)} target="_blank" rel="noreferrer">
                  장소 사이트에서 예약하기
                  <Icon name="external" size={14} strokeWidth={2.2} />
                </a>
              ) : null}
              {safeUrl(data.meeting.meetingUrl) ? (
                <a className="btn btn--ghost" style={{ height: 44, border: '1px solid var(--line)', fontSize: 14 }} href={safeUrl(data.meeting.meetingUrl)} target="_blank" rel="noreferrer">
                  회의 링크 열기
                  <Icon name="external" size={14} strokeWidth={2.2} />
                </a>
              ) : null}
            </div>
          </section>
        ) : (
          <>
            {/* 시간 후보 */}
            <section className="stack gap-8">
              <div className="hstack gap-8">
                <span className="t-14 t-strong grow">되는 시간을 눌러 주세요</span>
                <span className="t-12 t-muted">여러 개 골라도 돼요</span>
              </div>
              {data.noCommonTime ? <span className="t-12 t-warn">모두 되는 시간이 없어서 가능한 사람이 많은 시간을 보여줘요</span> : null}
              {data.candidates.length === 0 ? (
                <div className="card" style={{ gap: 6 }}>
                  <span className="t-14 t-strong">아직 가능한 시간이 없어요</span>
                  <span className="t-12 t-muted">아래 ‘다른 시간 알려주기’로 되는 시간을 알려 주세요</span>
                </div>
              ) : (
                <div role="group" aria-label="시간 후보 · 되는 시간 고르기" className="stack gap-8">
                  {data.candidates.map((t, i) => {
                    const on = picks.includes(t.id);
                    const who = t.explicitAvailableMemberIds.map(nameOf);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePick(t.id)}
                        className={`option${on ? ' option--on' : ''}`}
                        style={{ alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 14, background: 'var(--surface)' }}
                      >
                        <span style={{ display: 'flex', marginTop: 2 }}>
                          <CheckBox on={on} />
                        </span>
                        <span className="stack grow" style={{ gap: 3, textAlign: 'left' }}>
                          <span className="hstack gap-6">
                            <span className="t-15 t-strong">{timeLabel(t.startAt, t.endAt)}</span>
                            {i === 0 ? <span className="tag tag--accent">AI 추천</span> : null}
                            {owner && chosen === t.id ? <span className="tag tag--soft">확정할 시간</span> : null}
                          </span>
                          <span className="t-12 t-ok">{who.length ? `${who.join(', ')}님이 돼요` : '아직 된다고 한 사람이 없어요'}</span>
                          {t.unavailableMemberIds.length ? <span className="t-12 t-warn">{t.unavailableMemberIds.map(nameOf).join(', ')}님 안 됨</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="hstack gap-8">
                <span className="t-12 t-muted grow" aria-live="polite">{myStatus}</span>
                <button
                  type="button"
                  className="t-13 t-ink2 no-shrink"
                  style={{ border: 0, background: 'none', padding: '4px 0', textDecoration: 'underline' }}
                  disabled={busy || closed}
                  onClick={() => {
                    if (saveTimer.current) clearTimeout(saveTimer.current);
                    saveTimer.current = null;
                    setPicks([]);
                    setSaving('idle');
                    void action('respond', { kind: 'declined_all', selectedCandidateIds: [], customSlots: [] }, '다 안 돼요로 응답했어요');
                  }}
                >
                  다 안 돼요
                </button>
              </div>
            </section>

            {/* 장소 (대면) */}
            {data.mode === 'offline' ? (
              <section className="card" style={{ gap: 8 }}>
                <div className="hstack gap-8">
                  <Icon name="pin" size={18} strokeWidth={1.8} color="var(--accent)" />
                  <span className="t-14 t-strong grow">장소</span>
                </div>
                {/* 어떤 시간 · 지역 · 장소 종류로 찾았는지 한 칸에 모으고, 시간은 여기서 바꿔요 */}
                {candidate ? (
                  <div className="hstack gap-8" style={{ background: 'var(--bg)', borderRadius: 10, padding: '8px 8px 8px 12px' }}>
                    <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                      <span className="t-13 t-strong">{seoulLabel(candidate.startAt)} 기준</span>
                      {/* 팀원 출발지 가운데에서 고른 후보 지역(역) · 찾는 장소 종류 — 줄이지 않고 다 보여줘요 */}
                      <span className="t-12 t-muted" style={{ lineHeight: 1.5, wordBreak: 'keep-all' }}>
                        찾은 지역{' '}
                        {(places?.searchAreas ?? []).join(' · ') ||
                          (areasText ? areasText.split(',').map((v) => v.trim()).filter(Boolean).join(' · ') : '팀원 출발지 가운데')}
                      </span>
                      <span className="t-12 t-muted">장소 종류 {keyword || '회의 장소'}</span>
                    </span>
                    {owner && data.candidates.length > 1 ? (
                      <button type="button" className="btn btn--sm btn--ghost no-shrink" style={{ height: 34, fontSize: 13, border: '1px solid var(--line)' }} onClick={() => (busy ? toast.show('장소를 찾는 중이에요 · 끝나면 바꿀 수 있어요') : setSheet('time'))}>
                        시간 바꾸기
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {places?.status === 'error' ? <span className="t-12 t-warn">{places.error?.message ?? '일부 지역에서 찾지 못했어요'} · 시간과 응답은 그대로예요</span> : null}
                {ranked.length ? (
                  <div role="radiogroup" aria-label="장소 후보" className="stack gap-8">
                    {ranked.map((p) => (
                      <RadioCard
                        key={p.id}
                        on={placeId === p.id}
                        onClick={() => (!owner ? toast.show('장소는 방장이 골라요') : p.rank === null ? toast.show('이동시간을 몰라서 고를 수 없어요') : setPlaceId(p.id))}
                        title={`${p.name}${p.area ? ` · ${p.area}` : ''}`}
                        badge={p.rank !== null ? `${p.rank}위` : undefined}
                        lines={[
                          // 사람별 대중교통 시간 (나를 먼저): "희원(나) 36분 · 뇨뇨 38분"
                          {
                            text: p.travel
                              .slice()
                              .sort((a, b) => Number(b.memberId === data.viewerId) - Number(a.memberId === data.viewerId))
                              .map((t) => `${nameOf(t.memberId)}${t.memberId === data.viewerId ? '(나)' : ''} ${t.minutes === null ? '미확인' : `${t.minutes}분`}`)
                              .join(' · '),
                            className: 't-13 t-strong',
                          },
                          {
                            text:
                              p.rank === null
                                ? '순위 제외 · 누군가 1시간 초과, 또는 이동시간을 아는 팀원이 2명보다 적어요'
                                : `${p.rank}위 · ${p.travel.length > 2 ? '사람 간' : '두 사람'} 차이 ${p.travelTimeDifference ?? '?'}분 · 가장 오래 걸리는 사람 ${p.maxTravelMinutes ?? '?'}분` +
                                  (p.travel.some((t) => t.minutes === null) ? ` · 미확인 ${p.travel.filter((t) => t.minutes === null).length}명 빼고 계산` : ''),
                            className: 't-12 t-muted',
                          },
                        ]}
                      />
                    ))}
                  </div>
                ) : owner ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--outline"
                      style={{ height: 44 }}
                      disabled={busy || !candidate}
                      onClick={() => void autoSearch()}
                    >
                      {busy ? '찾는 중…' : '이 시간의 장소 찾기'}
                    </button>
                  </>
                ) : (
                  <span className="t-12 t-muted">방장이 장소를 찾으면 여기에 보여요</span>
                )}
                {/* 결과가 마음에 안 들 때: 지역 · 장소 종류를 바꿔서 다시 찾기 (결과 아래에 한 줄로) */}
                {owner && candidate ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ height: 40, fontSize: 13, border: '1px dashed var(--line-strong)', color: 'var(--ink-2)', fontWeight: 400 }}
                    // 찾는 동안에도 회색으로 바꾸지 않고, 누르면 안내만 해요
                    onClick={() => (busy ? toast.show('장소를 찾는 중이에요 · 끝나면 바꿀 수 있어요') : setSheet('areas'))}
                  >
                    {ranked.length ? '지역 · 장소 종류 바꿔서 다시 찾기' : '지역 · 장소 종류 직접 고르기'}
                  </button>
                ) : null}
                <span className="t-12 t-muted" style={{ lineHeight: 1.5 }}>최대 이동 1시간 · 시설과 이동시간은 예상값이에요</span>
              </section>
            ) : (
              <section className="card" style={{ padding: '12px 16px', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name="video" size={20} strokeWidth={1.8} color="var(--accent)" />
                <div className="stack gap-2 grow">
                  <span className="t-15 t-strong">온라인 회의</span>
                  <span className="t-12 t-muted">{data.meetingUrl ? '회의 링크를 넣어 뒀어요' : owner ? 'Zoom · Meet 주소를 넣어 두면 확정 카드에 보여요' : '방장이 회의 링크를 올려요'}</span>
                </div>
                {owner ? (
                  <button type="button" className="t-13 t-accent no-shrink" style={{ border: 0, background: 'none', padding: 0 }} onClick={() => setSheet('link')}>
                    {data.meetingUrl ? '링크 바꾸기 ›' : '링크 넣기 ›'}
                  </button>
                ) : null}
              </section>
            )}

            {/* 후보가 다 안 맞을 때: 다른 시간으로 응답 (+ 이번 회의에만 적용할 조건) */}
            <section className="card card--flush">
              <button type="button" className="row" onClick={() => (closed ? toast.show('응답 마감이 지났어요') : setSheet('other'))}>
                <span className="t-14 t-strong grow">후보에 맞는 시간이 없나요?</span>
                <span className="t-13 t-accent no-shrink">다른 시간 알려주기 ›</span>
              </button>
              <div className="divider" style={{ margin: '0 16px' }} />
              <Link href={`/proposals/${proposalId}/conditions`} className="row">
                <span className="t-14 grow">AI가 이해한 내 조건</span>
                <span className="t-13 t-accent no-shrink">보기 ›</span>
              </Link>
            </section>
          </>
        )}
      </div>

      <footer className="footer" style={{ padding: '8px 16px 16px', gap: 6 }}>
        {data.meeting ? (
          <Link href={`/teams/${data.teamId}`} className="btn btn--primary btn--block">
            대화방으로
          </Link>
        ) : owner ? (
          <>
            <span className="footer__note" style={{ color: canConfirm ? 'var(--ok)' : undefined }}>
              {confirmBlock}
            </span>
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={busy || !canConfirm}
              onClick={() => (available < data.totalCount ? setSheet('confirm') : void confirm())}
            >
              {candidate ? `${seoulLabel(candidate.startAt)}로 확정` : '이 시간으로 확정'}
            </button>
          </>
        ) : (
          <>
            <span className="footer__note">누르면 바로 저장돼요 · 확정은 방장({nameOf(data.ownerId)})이 해요</span>
            <Link href={`/teams/${data.teamId}`} className="btn btn--outline btn--block">
              대화방으로
            </Link>
          </>
        )}
      </footer>

      {sheet === 'time' ? (
        <Sheet open onClose={() => setSheet(null)} title="어느 시간으로 확정할까요?" sub="된다고 한 사람이 많은 시간이 먼저 골라져 있어요">
          <div role="radiogroup" aria-label="확정할 시간" className="stack gap-8">
            {data.candidates.map((t) => (
              <RadioCard
                key={t.id}
                on={chosen === t.id}
                onClick={() => {
                  chosenTouched.current = true;
                  setChosen(t.id);
                  setPlaceId('');
                  setSheet(null);
                }}
                title={timeLabel(t.startAt, t.endAt)}
                lines={[{ text: `${t.explicitAvailableMemberIds.length}명이 돼요`, className: 't-12 t-ok' }]}
              />
            ))}
          </div>
        </Sheet>
      ) : null}

      {sheet === 'confirm' && candidate ? (
        <Sheet open onClose={() => setSheet(null)} title="전원 참석이 확인되지 않았어요" sub={`된다고 고른 사람 ${available}명 / 팀원 ${data.totalCount}명`}>
          <div className="stack gap-6 t-14 t-ink2" style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '12px 14px', lineHeight: 1.55 }}>
            <span>
              지금 확정하면 <strong className="t-strong" style={{ color: 'var(--ink)' }}>{available}명 기준</strong>으로 <span style={{ whiteSpace: 'nowrap' }}>{timeLabel(candidate.startAt, candidate.endAt)}</span>에 정해져요.
            </span>
            <span className="t-13 t-muted">대화방에 확정 카드가 올라가고, 다른 팀원도 볼 수 있어요.</span>
          </div>
          <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={busy} onClick={() => void confirm()}>
            {busy ? '확정하는 중…' : '그래도 확정'}
          </button>
        </Sheet>
      ) : null}

      {sheet === 'areas' ? (
        <AreaPickerSheet
          initialAreas={areasText.split(',').map((v) => v.trim()).filter(Boolean)}
          initialKeyword={keyword}
          note={areaNote}
          busy={busy}
          onClose={() => setSheet(null)}
          onSearch={(areas, kw) => {
            setAreasText(areas.join(', '));
            setKeyword(kw);
            void searchPlaces(areas, kw).then((ok) => ok && setSheet(null));
          }}
        />
      ) : null}

      {sheet === 'link' ? (
        <LinkSheet
          initial={data.meetingUrl ?? ''}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={(url) => action('mode', { mode: 'online', meetingUrl: url }, '회의 링크를 저장했어요').then((ok) => ok && setSheet(null))}
        />
      ) : null}

      {sheet === 'other' ? (
        <OtherTimeSheet
          window={data.conditions.schedule.searchWindow}
          hours={(data.conditions.schedule as { meetingHours?: { start: string; end: string } }).meetingHours ?? { start: '09:00', end: '22:00' }}
          busy={busy}
          onClose={() => setSheet(null)}
          onAction={(name, payload, msg) => action(name, payload, msg).then((ok) => ok && setSheet(null))}
        />
      ) : null}

      <Toast message={toast.message} />
    </main>
  );

  /**
   * '이 시간의 장소 찾기': 지역이 없으면 팀원 출발지 가운데 역을 그 자리에서 다시 구해 바로 찾아요.
   * (팀원이 나중에 들어오거나 출발지를 바꿨을 수 있어서 매번 새로 구해요) 그래도 못 구하면 그때만 지역을 물어봐요.
   */
  async function autoSearch() {
    if (areasText.trim()) return searchPlaces();
    setBusy(true);
    let areas: string[] = [];
    let kw = keyword;
    try {
      const s = await suggestPlaceSearch(proposalId);
      areas = s.areas;
      kw = kw || s.keyword;
      setAreasText(areas.join(', '));
      setKeyword(kw);
      setAreaNote(`팀원 출발지 가운데 역이에요${s.unknownCount ? ` · 출발지를 모르는 ${s.unknownCount}명은 빼고 계산` : ''}`);
    } catch (e) {
      setAreaNote(e instanceof Error ? `${e.message} · 위치를 계산할 수 없는 출발지가 있으면 ‘내 정보’에서 역이나 건물로 다시 골라 주세요` : '지역을 골라 주세요');
    }
    setBusy(false);
    if (areas.length) return searchPlaces(areas, kw);
    setSheet('areas');
  }

  /** 고른 시간 + 지역(최대 3곳)으로 C 장소 찾기 */
  function searchPlaces(areas?: string[], kw?: string) {
    const list = areas ?? areasText.split(',');
    const searchAreas = [...new Set(list.map((v) => v.trim()).filter(Boolean))].slice(0, 3);
    // 저장된 B 장소 종류와 같으면 검색어를 보내지 않아요 → C가 conditions.placeType으로 찾아요 (화면 값이 B 결과를 덮어쓰지 않게)
    const send = (kw ?? keyword).trim();
    const payload = { timeOptionId: chosen, searchAreas, maxTravelMinutes: 60, ...(send && send !== storedType ? { keyword: send } : {}) };
    return action('places', payload, '이 시간의 장소를 찾았어요');
  }
}

/** 다른 시간 알려주기: 후보에 없는 되는 시간으로 응답 + (선택) 이번 회의에만 적용할 조건 */
/** ISO 시각 → "2026-11-10T14:00" (서울) */
const toLocal = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 16);
/** "2026-11-10T19:00" → 한 시간 뒤 */
const addHour = (local: string) => toLocal(new Date(Date.parse(`${local}:00+09:00`) + 3600_000).toISOString());

function OtherTimeSheet({
  window,
  hours,
  busy,
  onClose,
  onAction,
}: {
  /** 찾는 기간 — 이 안에서만 골라요 */
  window: { startAt: string; endAt: string };
  /** 매일 회의 가능 시간 (C meetingHours) — 안내에만 써요, C가 밖이면 막아요 */
  hours: { start: string; end: string };
  busy: boolean;
  onClose: () => void;
  onAction: (name: 'respond' | 'condition', payload: Record<string, unknown>, message: string) => void;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [picker, setPicker] = useState<null | 'start' | 'end'>(null); // 날짜 · 시간 시트 (제안 만들기와 같은 모양)
  const minDate = toLocal(window.startAt).slice(0, 10);
  const maxDate = toLocal(new Date(Date.parse(window.endAt) - 60_000).toISOString()).slice(0, 10);
  const label = (v: string) => (v ? `${dateLabel(v.slice(0, 10))} ${v.slice(11, 16)}` : '');
  const [kind, setKind] = useState<'unavailable' | 'preferred'>('unavailable');
  const slot = { startAt: toKst(start), endAt: toKst(end) };
  const ready = !!start && !!end && start < end;
  return (
    <>
    <Sheet open onClose={onClose} title="다른 시간 알려주기" sub={`후보에 없는 되는 시간을 알려 주면 AI가 추천을 다시 계산해요 · 매일 ${hours.start}~${hours.end} 안에서`}>
      <div className="stack gap-6">
        <span className="t-13 t-muted">언제 되나요?</span>
        <div className="hstack gap-8">
          <button type="button" className={`input grow${start ? '' : ' t-muted'}`} style={{ textAlign: 'left' }} aria-label={`시작 ${label(start) || '고르기'}`} onClick={() => setPicker('start')}>
            {label(start) || '시작'}
          </button>
          <span className="t-13 t-muted">~</span>
          <button type="button" className={`input grow${end ? '' : ' t-muted'}`} style={{ textAlign: 'left' }} aria-label={`끝 ${label(end) || '고르기'}`} onClick={() => setPicker('end')}>
            {label(end) || '끝'}
          </button>
        </div>
      </div>
      <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={busy || !ready} onClick={() => onAction('respond', { kind: 'custom', selectedCandidateIds: [], customSlots: [slot] }, '이 시간이 된다고 응답했어요')}>
        {busy ? '저장하는 중…' : '이 시간이 돼요'}
      </button>
      <div className="divider" />
      <div className="stack gap-6">
        <span className="t-13 t-muted">이번 회의에만 적용할 조건 (선택) · 위 시간을 ‘안 돼요’나 ‘되면 좋아요’로 남겨요</span>
        <div className="hstack gap-8">
          <button type="button" aria-pressed={kind === 'unavailable'} className={`chip${kind === 'unavailable' ? ' chip--on' : ''}`} onClick={() => setKind('unavailable')}>
            안 돼요
          </button>
          <button type="button" aria-pressed={kind === 'preferred'} className={`chip${kind === 'preferred' ? ' chip--on' : ''}`} onClick={() => setKind('preferred')}>
            되면 좋아요
          </button>
          <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} disabled={busy || !ready} onClick={() => onAction('condition', { kind, slot }, '이번 회의 조건을 저장했어요')}>
            조건으로 남기기
          </button>
        </div>
      </div>
    </Sheet>
    {picker ? (
      <DatePickerSheet
        title={picker === 'start' ? '언제부터 되나요?' : '언제까지 되나요?'}
        withTime
        value={picker === 'start' ? start || `${minDate}T${hours.start}` : end || (start ? addHour(start) : `${minDate}T${hours.end}`)}
        min={picker === 'end' && start ? start.slice(0, 10) : minDate}
        max={maxDate}
        onClose={() => setPicker(null)}
        onConfirm={(v) => {
          if (picker === 'start') {
            setStart(v);
            if (!end || end <= v) setEnd(addHour(v));
          } else setEnd(v);
          setPicker(null);
        }}
      />
    ) : null}
    </>
  );
}

/** (방장 · 온라인) 회의 링크 넣기 */
function LinkSheet({ initial, busy, onClose, onSave }: { initial: string; busy: boolean; onClose: () => void; onSave: (url: string) => void }) {
  const [url, setUrl] = useState(initial);
  return (
    <Sheet open onClose={onClose} title="회의 링크" sub="확정 카드에 ‘회의 링크 열기’로 보여요">
      <input className="input" type="url" autoFocus aria-label="회의 링크" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={busy} onClick={() => onSave(url.trim())}>
        {busy ? '저장하는 중…' : '저장'}
      </button>
    </Sheet>
  );
}
