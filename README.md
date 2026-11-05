# 싱클 (Syncle) · 프론트엔드

> 우리 팀의 대화가 일정이 되는 곳

디자인 캔버스의 화면 38개를 Next.js 15 (App Router) + TypeScript로 옮긴 프론트엔드예요.
지금은 **가짜 데이터(mock JSON)** 로 모든 화면이 실제처럼 이어져요. 백엔드 API가 준비되면 `src/lib/data.ts`만 바꿔 끼우면 돼요.

## 1. 실행하기

필요한 것: Node.js 20 이상

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 열어요.
**http://localhost:3000/screens** 에 모든 화면 목록이 있어서 발표·테스트할 때 편해요.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (코드를 고치면 바로 반영) |
| `npm run build` | 배포용으로 묶기 (Vercel도 이걸 써요) |
| `npm run typecheck` | 타입 오류만 검사 |

Vercel 배포: GitHub 저장소를 Vercel에 연결하면 끝이에요. 설정은 기본값 그대로 두면 돼요.

### 카카오 장소 검색 (출발지 고르기, 화면 2·1-1)

`.env.example`을 복사해 `.env.local`을 만들고 `KAKAO_REST_API_KEY=`에 카카오 개발자 콘솔의 **REST API 키**를 넣은 뒤 `npm run dev`를 다시 켜요.
카카오 콘솔에서 해당 앱의 **카카오맵 사용 설정**도 켜야 해요. Vercel에서는 Settings → Environment Variables에 같은 이름으로 넣어요.
키가 없으면 `src/mocks/place-search.json`(가짜 데이터)로 검색돼요. 검색은 서버 라우트 `/api/places/search`를 거쳐서 키가 브라우저에 보이지 않아요.

## 2. 폴더 구조

```
src/
├─ app/                  화면 (주소 = 폴더 경로)
│  ├─ globals.css        디자인 토큰(색·글꼴)과 공통 클래스
│  ├─ layout.tsx         모든 화면을 감싸는 틀
│  ├─ page.tsx           0 스플래시
│  ├─ login/ invite/ home/ me/ notifications/
│  ├─ teams/new/ join/
│  ├─ teams/[teamId]/    대화방 · ask/ all/ settings/
│  ├─ proposals/[proposalId]/  회의 제안 · places/ conditions/ no-match/
│  ├─ meetings/[meetingId]/    확정 회의 · minutes/
│  └─ screens/           화면 목록 (발표용)
├─ components/           여러 화면에서 같이 쓰는 부품
│  ├─ Icon, Logo, Avatar, TopBar, Sheet, Toast, Controls
│  ├─ home/              시작·홈·팀 만들기 화면 부품
│  ├─ chat/              대화방·팀 메뉴 화면 부품
│  └─ meeting/           제안·장소·회의 화면 부품
├─ mocks/                가짜 데이터 (JSON)
├─ lib/
│  ├─ data.ts            데이터 가져오기 ← 백엔드 연결할 곳
│  └─ demo-store.tsx     화면 사이에 이어지는 데모 상태
└─ types.ts              데이터 모양 (백엔드와 약속)
```

## 3. 화면 번호 ↔ 주소

| 번호 | 화면 | 주소 |
|---|---|---|
| 0 | 스플래시 | `/` |
| 0-1 | 로그인 | `/login` |
| 0-2 | 초대 링크로 들어온 로그인 | `/invite/7K2Q-HCI4` |
| 1-0 | 처음 로그인한 홈 | `/home?empty=1` |
| 1 | 홈 · 내 팀 | `/home` |
| 1-1 | 내 정보 | `/me` |
| 1-2 | 알림 | `/notifications` |
| 2 / 2-2 | 새 팀 만들기 / 매주 안 되는 시간 시트 | `/teams/new` / `?sheet=weekly` |
| 2-1 | 초대 링크로 참여하기 | `/join` |
| 3 | 대화방 · AI 제안 카드 | `/teams/hci4` |
| 3-1, 3-1-1 | @AI 부르기 → AI 정리 중 | `/teams/hci4?fresh=1` 에서 입력창에 `@` 입력 또는 안내 글의 `@AI` 누르기 |
| 3-1-2 | AI 정리 실패 | `/teams/hci4?fresh=1&fail=1` 에서 보내기 |
| 3-2 | 팀 메뉴 | `/teams/hci4?menu=1` |
| 3-2-1~3 | 전체 보기 (회의·자료·할 일) | `/teams/hci4/all?tab=meet\|files\|tasks` |
| 3-2-4 | 팀 설정 | `/teams/hci4/settings` |
| 3-3 | 지우님 화면 (AI 확인 질문) | `/teams/hci4/ask` |
| 3-4, 3-4-1 | 확정 후 대화방 / 팀 메뉴 | 5에서 '추천대로 확정' 뒤 `/teams/hci4` |
| 4 | + 메뉴 | `/teams/hci4?share=1` |
| 5, 5-1 | 회의 제안 (펼치기 포함) | `/proposals/p-1` |
| 5-2 | 내 응답 수정 시트 | `/proposals/p-1?sheet=reply` |
| 5 확정 확인 | 응답 안 한 팀원이 있을 때 '그래도 확정할까요?' 시트 | `/proposals/p-1?sheet=confirm` (또는 5에서 '추천대로 확정') |
| 5-3 | 모두 되는 시간이 없을 때 | `/proposals/p-1/no-match` |
| 6 | 장소 후보 | `/proposals/p-1/places` |
| 7 / 7-1 | 내 조건 / 조건 직접 추가 시트 | `/proposals/p-1/conditions` / `?sheet=add` |
| 8 | 확정된 회의 카드 | `/meetings/m-1` |
| 8-2 | 참석이 어려워요 시트 | `/meetings/m-1?sheet=absent` (예약은 '장소 사이트에서 예약하기'로 장소 사이트를 새 탭에서 열어요) |
| 9 | AI 회의록 | `/meetings/m-0/minutes` |

## 4. 데모 상태

화면 사이에 이어져야 하는 값(회의 확정 여부, 내 응답, 고른 장소, 읽은 알림 등)은 `src/lib/demo-store.tsx`에 있어요.
브라우저 탭을 닫기 전까지 유지되고, `/screens` 맨 아래에서 **처음 상태로 되돌리기**를 누르면 초기화돼요.
같은 곳에서 "11/11 회의 확정됨"을 켜면 확정 뒤 화면(3-4, 3-4-1, 홈의 확정 카드)을 바로 볼 수 있어요.

## 5. 백엔드 연결하는 방법

1. 화면은 데이터를 **항상 `src/lib/data.ts`의 함수**로 가져와요. 각 함수 위 주석에 연결할 API 주소와 담당(A~D)이 적혀 있어요.
2. API가 준비되면 그 함수 안쪽만 `fetch`로 바꿔요. 돌려주는 모양은 `src/types.ts`와 같아야 해요.
3. 지금 함수들은 바로 값을 돌려주지만, 실제 API는 기다려야(비동기) 해요. 바꿀 때는 화면에서 `useEffect` + `useState`로 불러오거나, 팀에서 정한 방식(예: SWR)을 쓰면 돼요. AI에게 "data.ts의 getProposal을 /api/proposals/:id fetch로 바꾸고, 쓰는 화면도 로딩 상태를 넣어 고쳐줘"처럼 하나씩 요청하세요.
4. `demo-store.tsx`의 값 중 서버에 저장해야 하는 것(확정, 응답, 조건, 할 일 완료 등)은 해당 API를 부르도록 바꿔요.

## 6. 디자인 규칙 (화면 원칙)

1. 모든 화면은 휴대폰 한 화면(390×844) 안에 — 길게 스크롤하지 않기
2. 핵심 하나만 크게, 나머지는 '펼치기'로 접어두기
3. 자세한 비교는 다음 화면으로 넘기기
4. 화면마다 주 버튼은 하나
5. AI가 정한 것은 항상 이유와 근거를 함께 보여주기
6. 시간 정하기는 '응답'으로 통일 — 따로 투표를 받지 않음
7. 확정은 방장만, 나머지는 응답·수정만
8. AI가 일하는 동안은 단계를 보여주고, 실패해도 된 부분은 먼저 쓸 수 있게

색·글꼴은 `src/app/globals.css` 맨 위 `:root`에서만 바꿔요.

## 7. 백엔드 연결 현황 (B · D)

받은 코드는 `src/server/b`(성하, 회의 조건 추출), `src/server/c`(지우, 시간 후보 · 회의 제안), `src/server/d`(현규, 장소 추천)에 **그대로** 두었어요.
C의 `shared/b-c-contract.ts`만 B의 최신 규격을 다시 내보내도록 바꿨어요 (같은 모양 + `preferredSlots`).
각 파일 끝의 단독 실행용 예시(`if (import.meta.main) {…}`)만 Next.js에서 돌 수 없어 뺐어요. 원본 설명은 같은 폴더의 `B_README.md`, `D_README.md`, `D_CONTRACT.md`에 있어요.
우리 앱 모양으로 바꾸는 일은 `src/server/ai-adapter.ts`(B), `src/server/proposal-adapter.ts`(C), `src/server/places-adapter.ts`·`area-search.ts`(D)에서만 해요.

| 담당 | 서버 주소 | 쓰는 화면 | 필요한 키 | 키가 없으면 |
|---|---|---|---|---|
| D 장소 추천 | `POST /api/places/recommend` | 6 장소 후보 → 5·8·대화방 카드 | `KAKAO_REST_API_KEY` | 가짜 장소 3곳 ('예시 데이터' 표시, 같은 추천 기준 적용) |
| B 회의 조건 | `POST /api/ai/request` | 3 대화방 '@AI 회의 잡아줘' | `GEMINI_API_KEY` | 예시 조건(`src/mocks/b-conditions.json`)으로 C를 돌려요 |
| C 시간 후보 · 제안 | `POST /api/ai/request` (B 다음) | 3 제안 카드 · 5 회의 제안 · 6 · 3-3 · 홈 | 없음 (계산만 해요) | — |

**장소 추천 기준** (`src/lib/place-ranking.ts`, 팀 합의 11/5)
1. 누군가 1시간(`MAX_TRAVEL_MINUTES`)을 넘게 걸리는 장소는 뺀다
2. 남은 장소는 팀원 간 이동시간 차이(최장 − 최단)가 작은 순
3. 차이가 같으면 가장 오래 걸리는 사람의 시간이 짧은 순

**지역 찾기** (`src/server/area-search.ts`): 팀원 출발지의 가운데에서 가까운 지하철역 3곳(서로 1.5km 이상 떨어진 곳)을 후보 지역으로 잡고,
역 1km 안(없으면 2.5km)에서 AI가 대화로 고른 장소 종류(`src/lib/place-intent.ts`)를 찾아요. 출발지·경로 계산은 D 함수(`resolveOrigin`, `getTransitRoute`)를 그대로 써요.
D의 `findPlaces`·`rankPlacesByFairness`는 글자 검색·예전 순위 기준이라 지금은 쓰지 않아요 (D 담당과 맞추기).

아직 임시로 정해 둔 것 (C와 합의 필요):
- 팀원 출발지: `src/mocks/member-origins.json` (나중에 A의 프로필 출발역)
- C가 만든 제안은 이 팀의 제안 자리(`p-1`)를 바꿔 끼워요. 응답 마감·장소는 C가 정하지 않아서 기존 값을 이어받아요
- C의 투표·확정(`proposal-flow.ts`)과 캘린더(`meeting-calendar.ts`)는 들어왔지만 아직 화면과 연결하지 않았어요 (A의 저장이 필요해요)
