# 싱클 인수인계 (2026-11-05 기준)

새 작업을 시작할 때 이 문서와 `README.md`를 먼저 읽어요. AI(Claude)에게 맡길 때도 "docs/HANDOFF.md랑 README.md 읽고 이어서 하자"로 시작하면 돼요.

---

## 1. 지금 상태 한눈에

| 항목 | 상태 |
|---|---|
| 프론트 저장소 | [kccprogramming/syncle-web](https://github.com/kccprogramming/syncle-web) (공개) |
| `main` 브랜치 | 가짜 데이터 데모. [syncle-web.vercel.app](https://syncle-web.vercel.app)에 배포 중 |
| `integration/b-d` 브랜치 | `main` + **B · C · D 백엔드 연결** (이름은 b-d지만 C도 들어 있어요). Vercel 미리보기로만 보여요 |
| 최종 코드 | 조직의 `final` 저장소에 올릴 예정 (아직 비어 있어요) |
| 팀원 원본 코드 | `kccprogramming/just_keeping` 저장소의 브랜치들 (아래 4장) |

`integration/b-d`의 커밋 (오래된 것부터):

1. `6cca425` B·D 백엔드 연결
2. `bf0b7df` 6에서 장소 종류 고르기 + 2-1에서 팀원이 직접 출발지 정하기
3. `0e100d1` AI가 대화를 보고 장소 종류(합주실·회식 장소 …) 정하기
4. `6e2faf6` 공평한 지역 찾기 + 팀 추천 기준 + 지역별 추천 이유
5. `868c7ae` C(시간 후보 · 회의 제안) 합치기

---

## 2. 팀이 정한 것 (바꾸려면 팀 합의)

- **로그인**: Google만. 카카오 로그인은 뺐어요 (카카오는 장소 검색에만 써요).
- **예약**: 앱에서 예약하지 않고 '장소 사이트에서 예약하기'로 카카오맵 장소 페이지를 새 탭으로 열어요. 8-1 예약 시트는 없앴어요.
- **확정**: 방장만. 응답 안 한 팀원이 있으면 '그래도 확정할까요?' 시트로 한 번 더 물어요 (모두 응답했으면 바로 확정).
- **장소 종류**: 사람이 고르지 않고 **AI가 대화를 보고** 정해요 (합주 → 합주실, 회식·저녁 → 회식 장소, 회의·발표 → 회의 장소 …). 6에서 '바꾸기'로만 직접 바꿀 수 있어요. → `src/lib/place-intent.ts`
- **장소 추천 기준** (11/5 합의) → `src/lib/place-ranking.ts`
  1. 누군가 **1시간**(`MAX_TRAVEL_MINUTES`)을 넘게 걸리는 장소는 뺀다
  2. 팀원 간 이동시간 **차이**(최장 − 최단)가 작은 순
  3. 차이가 같으면 **가장 오래 걸리는 사람**의 시간이 짧은 순
- **지역**: 서울역 같은 고정값 없이, 팀원 출발지 가운데에서 가까운 지하철역 3곳(서로 1.5km 이상)을 후보 지역으로 잡아요. 역 1km 안(없으면 2.5km)에서 장소를 찾아요. → `src/server/area-search.ts`
- **출발지**: 각자 직접 정해요 (2 새 팀, 2-1 팀 참여, 1-1 내 정보에서 검색 + 지도). 팀원에게는 동네까지만 보여요.

---

## 3. 흐름 (integration/b-d 기준)

```
3 대화방 "@AI 회의 잡아줘" (합주·회식도)
  → POST /api/ai/request
      B: 대화 → 회의 조건 (GEMINI_API_KEY 없으면 src/mocks/b-conditions.json 예시 조건)
      C: 회의 조건 → 시간 후보 3개 계산 → 회의 제안 (화면용 Proposal로 변환)
      장소 종류: 대화·조건에서 고름 (place-intent)
  → 대화방 제안 카드 · 5 회의 제안 · 3-3 · 홈이 C의 제안을 보여줘요 (demo-store의 cProposal, useProposal())
6 장소 후보
  → POST /api/places/recommend
      팀원 출발지 → 가운데 지역 3곳 → 지역마다 장소 → 팀원별 대중교통 시간(D 함수) → 팀 기준 순위
  → 지역 탭 · 지역 이유 · 장소 이유. 고른 장소는 5 · 8 · 대화방 카드에 이어져요 (chosenPlace)
```

연결 파일 (받은 코드는 고치지 않고 여기서만 맞춰요):

| 담당 | 받은 코드 | 연결 파일 | 서버 주소 |
|---|---|---|---|
| B 성하 | `src/server/b` | `src/server/ai-adapter.ts` | `/api/ai/request` |
| C 지우 | `src/server/c` | `src/server/proposal-adapter.ts` | `/api/ai/request` (B 다음) |
| D 현규 | `src/server/d` | `src/server/area-search.ts`, `places-adapter.ts` | `/api/places/recommend` |
| A 현서 | 아직 없음 | — | — |

받은 코드에서 바꾼 것은 두 가지뿐이에요: 각 파일 끝의 단독 실행 예시(`if (import.meta.main) {…}`) 삭제, C의 `shared/b-c-contract.ts`를 B 최신 규격으로 연결.

---

## 4. 팀원 원본 위치 (`kccprogramming/just_keeping`)

| 담당 | 브랜치 | 가져온 커밋 |
|---|---|---|
| A 현서 | `a-hyunseo/feature-code` → `contributions/a-hyunseo/` | 아직 안 가져옴 |
| B 성하 | `share/sungha-b-final` → `sungha_B_code/` | `1ec9384` |
| C 지우 | `share/jiwoo-c-code` → `jiwoo_C_code/` | `f482f55` |
| D 현규 | `feature/d-place-recommendation` → `D_HANDOFF/` | `2426bba` |

팀원이 코드를 고치면 해당 폴더(`src/server/b|c|d`)만 새 버전으로 바꿔 끼우고, 연결 파일이 깨지는지 확인하면 돼요.

---

## 5. 키 · 환경 설정

| 이름 | 어디에 | 없으면 |
|---|---|---|
| `KAKAO_REST_API_KEY` | `.env.local` + Vercel 환경 변수 (이미 넣음) | 장소 검색·추천이 예시 데이터로 동작 |
| `GEMINI_API_KEY` | `.env.local` + Vercel (아직 없음) | B 대신 예시 조건으로 C가 계산 |
| `GEMINI_MODEL` | 선택 | B 기본값 `gemini-3.1-flash-lite` |

- 키는 채팅·문서에 쓰지 않아요. `.env.local`은 git에 올라가지 않아요.
- `.env.local`에는 `KAKAO_REST_API_KEY=값` 한 줄만 (앞부분을 두 번 붙여넣지 않게 주의).
- 카카오 앱 '싱클'(ID 1638343)은 카카오맵 사용 설정이 켜져 있어야 해요. 무료 쿼터는 계정당 처음 켠 앱 하나에만 붙어요.
- Vercel 무료(Hobby)는 조직의 **비공개** 저장소를 배포할 수 없어서 `syncle-web`을 공개로 바꿨어요.

---

## 6. 남은 일 (우선순위 순)

1. **A 연결 (현서님)**: Supabase 로그인 · 팀 · 대화 메시지 · 프로필 출발지 저장.
   - Supabase 프로젝트 URL·공개키, `schema-draft.sql` 적용 여부를 먼저 확인
   - `src/lib/data.ts`의 함수 안쪽만 API 호출로 바꿔요 (각 함수 위에 담당·API 주소 주석). `saveMyOrigin`이 출발지 저장 자리예요
   - `src/mocks/member-origins.json`(팀원 출발지 임시값)과 `demo-store`의 서버 저장 대상(확정, 응답, 출발지, 할 일)을 A API로 바꾸기
2. **C의 투표 · 확정 저장**: `src/server/c/features/proposals/proposal-flow.ts`(castVote, confirmProposal)와 `meeting-calendar.ts`(.ics)는 들어왔지만 화면과 연결 전이에요. A의 저장이 있어야 여러 사람 응답이 모여요.
3. **Gemini 키로 B 실제 확인**: 키를 받으면 '@AI 회의 잡아줘'로 실제 조건 카드가 나오는지 확인.
4. **`integration/b-d` → `final`**: 팀 확인 뒤 최종 저장소로 옮기기.

---

## 7. 팀원에게 전달할 것

- **성하님 (B)**
  - AI 출력에 '장소 종류'(placeType) 항목 추가 → 지금의 낱말 규칙(`place-intent.ts`) 대신 AI가 직접 정하게
  - `classifyRequest`가 '합주 잡아줘', '회식 잡아줘'도 일정 잡기로 받게 (지금은 회의·미팅만)
- **현규님 (D)**
  - 새 추천 기준(1시간 제한 → 차이 → 최장)을 D 코드에 반영할지. 지금 D의 `rankPlacesByFairness`는 예전 기준(최장 우선)이라 앱은 `place-ranking.ts`를 써요
  - `findPlaces`가 글자로만 검색해서 다른 동네 장소가 섞여요 → 좌표·반경 검색 (`area-search.ts` 참고)
  - 걸어갈 만큼 가까우면 대중교통 경로가 없어 '미확인'이 돼요 → 도보 시간으로 처리
- **지우님 (C)**
  - C는 시간 후보마다 장소를 따로 찾게 되어 있어요. 앱은 장소를 6(지역 찾기)에서 한 번만 찾아요 → 맞출 방법
  - 응답 마감은 C가 정하지 않아서 예시 값(11/6 21:00)을 써요 → 마감 정하는 주체
- **현서님 (A)**: 6장 1번

---

## 8. 작업할 때 주의

- 규칙: 색·글꼴은 `src/app/globals.css` 토큰만, 모든 화면은 휴대폰 한 화면(390×844) 안에, 데이터는 `src/lib/data.ts` 함수로만.
- 배포용 빌드(`npm run build`)는 개발 서버가 켜져 있으면 `.next` 폴더가 꼬일 수 있어요. 개발 서버를 끄거나 다른 폴더 사본에서 돌려요.
- 카카오 로컬 API 응답은 따로 저장해 쓰면 안 돼요 (카카오 약관). 사용자가 고른 출발지를 프로필에 저장하는 건 약관을 한 번 확인하기.
- 데모 상태는 브라우저 탭에만 저장돼요. `/screens` 맨 아래 '처음 상태로 되돌리기'로 초기화해요.
