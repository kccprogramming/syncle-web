'use client';

/**
 * 장소를 찾을 지역 고르기 (C 화면 · 방장)
 * 역이나 동네 이름을 치면 카카오 위치 검색 결과가 떠요(출발지 고르기와 같은 검색). 눌러서 최대 3곳까지 담아요.
 * 담은 이름은 C의 POST /places 에 searchAreas로 그대로 보내요 (예: "서울역", "종로3가역").
 */
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { searchPlaces } from '@/lib/data';
import type { PlaceSearchResult } from '@/types';

const MAX_AREAS = 3;
/** "서울역 1호선" → "서울역" (역은 노선 이름을 빼요) */
const areaName = (p: PlaceSearchResult) => p.name.match(/^(.+?역)(\s|$)/)?.[1] ?? p.name;

export function AreaPickerSheet({
  initialAreas,
  initialKeyword,
  note,
  busy,
  onClose,
  onSearch,
}: {
  initialAreas: string[];
  initialKeyword: string;
  /** 자동으로 채운 지역 설명, 또는 못 채운 이유 */
  note?: string;
  busy: boolean;
  onClose: () => void;
  onSearch: (areas: string[], keyword: string) => void;
}) {
  const [areas, setAreas] = useState<string[]>(initialAreas.slice(0, MAX_AREAS));
  const [keyword, setKeyword] = useState(initialKeyword);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  // 입력을 멈추고 0.25초 뒤에 찾아요. 새로 입력하면 이전 요청은 취소해요
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      searchPlaces(q, ctrl.signal)
        .then((r) => {
          setResults(r.slice(0, 6));
          setStatus('done');
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== 'AbortError') setStatus('error');
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const add = (p: PlaceSearchResult) => {
    const name = areaName(p);
    setAreas((prev) => (prev.includes(name) || prev.length >= MAX_AREAS ? prev : [...prev, name]));
    setQuery('');
  };
  const full = areas.length >= MAX_AREAS;

  return (
    <Sheet open onClose={onClose} title="어디서 찾을까요?" sub="역이나 동네를 최대 3곳 골라요 · 지역마다 장소를 찾아 함께 비교해요">
      {/* 담은 지역 */}
      <div className="hstack gap-8" style={{ flexWrap: 'wrap', minHeight: 34 }}>
        {areas.map((a) => (
          <span key={a} className="chip chip--soft" style={{ padding: '0 4px 0 12px', gap: 2 }}>
            <Icon name="pin" size={14} />
            {a}
            <button
              type="button"
              aria-label={`${a} 빼기`}
              onClick={() => setAreas((prev) => prev.filter((x) => x !== a))}
              className="hstack"
              style={{ width: 28, height: 28, border: 0, borderRadius: 14, background: 'none', color: 'var(--accent-strong)', justifyContent: 'center' }}
            >
              <Icon name="close" size={14} strokeWidth={2.4} />
            </button>
          </span>
        ))}
        {areas.length === 0 ? <span className="t-13 t-muted">아래에서 검색해 지역을 담아 주세요</span> : null}
      </div>
      {note ? <span className="t-12 t-muted" style={{ lineHeight: 1.5 }}>{note}</span> : null}

      {/* 위치 검색 */}
      <div className="hstack gap-8" style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, color: 'var(--muted)', display: 'inline-flex' }}>
          <Icon name="search" size={18} />
        </span>
        <input
          className="input"
          type="search"
          aria-label="지역 검색"
          placeholder={full ? '3곳을 모두 담았어요 · 빼고 다시 담을 수 있어요' : '예: 서울역, 종로3가, 강남'}
          disabled={full}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ paddingLeft: 40 }}
        />
      </div>
      {query.trim() ? (
        <div className="stack" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {status === 'loading' ? <span className="t-13 t-muted" style={{ padding: '8px 0' }}>찾는 중…</span> : null}
          {status === 'error' ? <span className="t-13 t-warn" style={{ padding: '8px 0' }}>위치를 찾지 못했어요 · 다시 입력해 주세요</span> : null}
          {status === 'done' && results.length === 0 ? <span className="t-13 t-muted" style={{ padding: '8px 0' }}>검색 결과가 없어요</span> : null}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="hstack gap-10"
              style={{ minHeight: 52, border: 0, borderBottom: '1px solid var(--line-2)', background: 'none', textAlign: 'left', padding: '6px 0' }}
              onClick={() => add(p)}
            >
              <span style={{ color: 'var(--accent)', display: 'inline-flex', flexShrink: 0 }}>
                <Icon name="pin" size={18} />
              </span>
              <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                <span className="t-14 t-strong t-ellipsis">{p.name}</span>
                <span className="t-12 t-muted t-ellipsis">{p.roadAddress || p.address}</span>
              </span>
              <span className="t-13 t-accent no-shrink">담기</span>
            </button>
          ))}
        </div>
      ) : null}

      <label className="stack gap-6">
        <span className="t-13 t-muted">찾을 장소</span>
        <input className="input" aria-label="찾을 장소" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="예: 스터디룸, 합주실" />
      </label>

      <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={busy || areas.length === 0 || !keyword.trim()} onClick={() => onSearch(areas, keyword.trim())}>
        {busy ? '찾는 중…' : `${areas.length ? areas.join(' · ') : '지역'}에서 장소 찾기`}
      </button>
    </Sheet>
  );
}
