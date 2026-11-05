# 싱클 인수인계 (2026-11-06 기준)

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
| C 지우 (예시 흐름) | `src/server/c` | `src/server/proposal-adapter.ts` | `/api/ai/request` (B 다음) |
| C 지우 (실제 저장) | `src/server/scheduling`, `src/features/scheduling`, `src/components/scheduling`, `src/lib/scheduling-client.ts` | `src/app/api/places/areas` (지역·장소 종류 추천) | `/api/scheduling/*` |
| A 현서 (서버 도우미) | `src/server/a/private-team-origins.ts` | — | (C·지역 추천이 팀원 출발지를 읽을 때) |
| D 현규 | `src/server/d` | `src/server/area-search.ts`, `places-adapter.ts` | `/api/places/recommend` |
| A 현서 | 아직 안 가져옴 (PR 아래 4장) | `src/lib/data.ts` | Supabase 직접 + A의 `/api/tasks`·`/api/notifications`·`/api/account` |

받은 코드에서 바꾼 것은 두 가지뿐이에요: 각 파일 끝의 단독 실행 예시(`if (import.meta.main) {…}`) 삭제, C의 `shared/b-c-contract.ts`를 B 최신 규격으로 연결.

---

## 4. 팀원 원본 위치 (`kccprogramming/just_keeping`)

| 담당 | 브랜치 | 가져온 커밋 |
|---|---|---|
| A 현서 | `a-hyunseo/feature-code` → `contributions/a-hyunseo/` ([PR #2](https://github.com/kccprogramming/just_keeping/pull/2), 열림) | 아직 안 가져옴 |
| B 성하 | `share/sungha-b-final` → `sungha_B_code/` | `1ec9384` |
| C 지우 | `share/jiwoo-c-code` → `jiwoo_C_code/` | `f482f55` (예시 흐름), `a9c6fb0`의 `integration/syncle-web/` (실제 저장) |
| D 현규 | `feature/d-place-recommendation` → `D_HANDOFF/` | `2426bba` |

팀원이 코드를 고치면 해당 폴더(`src/server/b|c|d`)만 새 버전으로 바꿔 끼우고, 연결 파일이 깨지는지 확인하면 돼요.

---

## 5. 키 · 환경 설정

| 이름 | 어디에 | 없으면 |
|---|---|---|
| `KAKAO_REST_API_KEY` | `.env.local` + Vercel 환경 변수 (이미 넣음) | 장소 검색·추천이 예시 데이터로 동작 |
| `GEMINI_API_KEY` | `.env.local` + Vercel (아직 없음) | B 대신 예시 조건으로 C가 계산 |
| `GEMINI_MODEL` | 선택 | B 기본값 `gemini-3.1-flash-lite` |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel (각자 직접) | A 연결 전이라 지금은 안 써요 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` + Vercel (각자 직접, 채팅으로 안 보내요) | 〃 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 `.env.local` + Vercel만 (브라우저·GitHub 금지) | 회원 탈퇴, 팀원 출발지 읽기(005)가 안 돼요 |

- 키는 채팅·문서에 쓰지 않아요. `.env.local`은 git에 올라가지 않아요.
- `.env.local`에는 `KAKAO_REST_API_KEY=값` 한 줄만 (앞부분을 두 번 붙여넣지 않게 주의).
- 카카오 앱 '싱클'(ID 1638343)은 카카오맵 사용 설정이 켜져 있어야 해요. 무료 쿼터는 계정당 처음 켠 앱 하나에만 붙어요.
- Vercel 무료(Hobby)는 조직의 **비공개** 저장소를 배포할 수 없어서 `syncle-web`을 공개로 바꿨어요.

---

## 6. 남은 일 (우선순위 순)

1. **A 연결 (현서님)**: Supabase 로그인 · 팀 · 대화 메시지 · 프로필 출발지 저장.
   - 11/6 현서님 공유: 프로젝트 URL `https://rlldzrffwbpydhaxxyzs.supabase.co`. 공개키는 각자 `.env.local`·Vercel에 직접 넣어요.
   - DB: `profiles`, `teams`, `team_members`, `messages`와 주요 열은 있음 (단 `schema-draft.sql`을 실행한 기록이 남아 있다는 뜻은 아님). 004(확정 메시지 · 비공개 링크)와 005(팀원 출발지 계산용)는 실행 완료 (005는 11/6 희원). 002·003은 004의 전제라 적용된 것으로 보여요.
   - A 코드: `just_keeping` PR #2. Supabase 접속(`lib/supabase/client.ts`, `server-api.ts`)과 API(`/api/tasks`, `/api/notifications`, `/api/account`). 서버 API는 로그인 토큰을 `Authorization: Bearer`로 받아요.
   - 확정 메시지: 일반 사용자는 `messages`에 `confirmed`를 직접 못 넣어요. 서버가 **로그인한 방장의 토큰으로** `create_confirmed_message(p_team_id, p_content, p_visible_to)`를 불러야 해요 (C 확정과 같이 연결).
   - **Google 로그인 연결 완료 (11/6)**: `src/lib/supabase.ts`(접속·로그인·로그아웃·`useAuthUser`), 0-1·0-2 로그인 버튼, 돌아오는 화면 `/auth/callback`(팀 있으면 1, 없으면 1-0), 1-1 내 정보의 계정 표시·로그아웃. 키가 없으면 예전 데모로 움직여요. Supabase Redirect URLs에 `http://localhost:3000/**` 넣음 (Vercel 주소는 배포 때 추가).
   - **내 정보 저장 연결 완료 (11/6)**: 로그인하면 1-1의 출발지 · 매주 안 되는 시간 · 알림을 Supabase에서 읽고 저장해요 (`data.ts`의 `loadMyProfile`, `saveMyOrigin`, `saveMyWeekly`, `saveMyNotifications`). 정확한 출발지는 `profile_private_locations.departure_origin`(D에 넘기는 글자: 역 이름 또는 도로명 주소), 동네는 `profiles.departure_neighborhood`, 매주 안 되는 시간은 A 방식대로 한 줄 글 배열(`weekly_unavailable`).
   - 주의: `data.ts`는 서버 라우트에서도 쓰여서 `supabase.ts`에는 React 훅을 넣지 않아요 (넣으면 `/api/*`가 깨져요). 로그인 사용자 훅은 `use-auth-user.ts`.
   - **팀 연결 완료 (11/6)**: 로그인하면 1 홈은 내 진짜 팀(`loadMyTeams`, 없으면 1-0), 2 새 팀 만들기는 `create_team`(만든 사람 = 방장, 진짜 초대 링크 복사, 추가한 매주 안 되는 시간은 프로필에 저장), 0-2 초대 화면은 `preview_team_invite`(로그인 전에도), 2-1 참여는 `join_team` + 이름(`profiles.nickname`) · 출발지 저장. 진짜 초대 코드는 32자리라 데모 코드(`7K2Q-HCI4`)와 구분해요 (`isLiveInviteCode`).
   - 3 대화방: 진짜 팀(UUID)이면 `loadTeam`으로 이름 · 인원 · AI 설정을 보여주고 데모 요약 줄은 숨겨요.
   - **대화 메시지 연결 완료 (11/6)**: 진짜 팀 대화방은 `loadTeamMessages`(최근 200개) · `sendTeamMessage`(general) · `subscribeTeamMessages`(Supabase Realtime, 새 메시지 바로 표시)를 써요. 팀원 이름은 `loadTeamMembers`가 불러와 `getMember`가 진짜 이름을 돌려줘요. 확정 · 알림 같은 AI 메시지는 지금은 한 줄 안내(system)로 보여요. '@AI'는 저장만 하고 "C 연결 뒤에 열려요" 안내.
   - **사진 · 파일 올리기 (11/6)**: 4 + 메뉴는 사진 · 파일 · 할 일 · AI로 회의 잡기 4개 (투표 · 링크는 뺌, AI 회의 잡기 강조 없앰). 진짜 팀이면 `uploadTeamFile`이 비공개 보관함 `team-materials`의 `팀ID/내ID/무작위.확장자`에 올리고(20MB 제한), 대화방에 `📎 이름 · 크기` 메시지를 남기고, `team_materials`에 그 메시지(`source_message_id`)와 이어서 저장해요. 사진은 대화방에서 사진으로 보여요(`teamImageUrls`, 1시간짜리 서명 주소), 다른 파일은 📎 말풍선 → 누르면 새 탭으로 열려요.
   - **팀 메뉴 · 전체 보기의 사진 · 자료 (11/6)**: 진짜 팀이면 `loadTeamMaterials`로 팀 자료를 읽어요 (메뉴를 열 때마다 새로). 팀 메뉴에 '사진' 칸(썸네일 8장)과 '자료' 칸(사진 아닌 파일 3개), 전체 보기에 '사진' 탭(3칸 격자) 추가. 누르면 `materialUrl`로 새 탭에서 열려요.
   - 아직: 팀 메뉴의 회의 · 할 일은 데모 함수라 진짜 팀에서는 비어 있어요. + 메뉴의 '할 일'도 준비 중.
   - 다음: 대화방 '@AI 회의 잡아줘' → C 제안 만들기 (C SQL 적용 뒤). 그다음 대화방 '@AI 회의 잡아줘' → C 제안 만들기(`createLiveProposal`, 응답 마감 · 자료 마감 입력).
   - 팀원 출발지: D 계산용 정확한 출발지는 `profile_private_locations`에 있고, 서버만 `get_team_private_origins_for_calculation`(005, service role 키)으로 읽어요. 브라우저에서 부르지 않아요.
   - `src/lib/data.ts`의 함수 안쪽만 API 호출로 바꿔요 (각 함수 위에 담당·API 주소 주석). `saveMyOrigin`이 출발지 저장 자리예요
   - `src/mocks/member-origins.json`(팀원 출발지 임시값)과 `demo-store`의 서버 저장 대상(확정, 응답, 출발지, 할 일)을 A API로 바꾸기
2. **C의 응답 · 확정 저장 — 코드 합침 (11/6), SQL 적용·실제 확인 남음**
   - 합친 방법 (지우님 묶음 `a9c6fb0`은 예전 `main` 기준이라 덮어쓰지 않았어요):
     - 새 파일만 그대로 추가: `/api/scheduling/*`, `src/server/scheduling`, `src/features/scheduling`, `src/components/scheduling/LiveProposal.tsx`, `src/lib/scheduling-client.ts`, `supabase/c-scheduling-review.sql`, `tests/c-*.test.ts` (`npm run test:c`, 9개 통과)
     - 묶음의 `vendor/b`, `vendor/d`는 우리 `src/server/b`, `src/server/d`와 같은 코드라 넣지 않고 그쪽을 가리키게 import만 바꿨어요. `vendor/a` → `src/server/a`. `features/shared/b-c-contract.ts`도 우리 B 것과 같아서 B 것을 써요.
     - 지우님이 팀 기준(1시간 → 차이 → 최장)으로 고친 D 순위 함수 복사본은 `src/features/scheduling/rank-places-team-rule.ts`에 뒀어요. 현규님 D에 반영되면 바꿔요.
     - `package.json`은 필요한 것만 추가 (`server-only`, 개발용 `@electric-sql/pglite`·`tsx`, `test:c`). `tsconfig.json`은 바꿀 것 없음.
     - 5 화면: 실제 제안(UUID)이면 지우님 C 화면(`LiveProposal`), 예시(`p-1`)면 지금 데모 화면. 6 화면도 실제 제안이면 C 화면으로 보내요 (장소 찾기·확정이 그 안에 있어요).
     - C 화면의 '비교할 지역'과 '찾을 장소'는 우리 `/api/places/areas`가 미리 채워요: 팀원 출발지(A 005, 서버에서만) 가운데 역 3곳 + 대화로 고른 장소 종류. 방장이 고칠 수 있어요.
   - **C API 보낼 때 규칙 (11/6 지우님)** — `LiveProposal`의 `action()`과 `scheduling-client.ts`가 지켜요:
     - 바꾸는 요청(respond · condition · mode · remind · places · confirm)에는 모두 지금 제안의 `version`을 넣어요. 다른 사람이 먼저 바꿨으면 `C_STALE_VERSION` → 다시 불러와요.
     - 응답은 `/respond`. 되는 시간 `kind: "selected"`, '다 안 돼요'는 `kind: "declined_all"`, 직접 입력 `kind: "custom"`.
     - 장소는 고른 `timeOptionId` + `searchAreas`(1~3곳, 빈 칸·중복 제거)를 `/places`로. 확정은 그 응답 `placeResults`에 저장된 장소 ID로 `/confirm` { `timeCandidateId`, `placeId`(온라인이면 null), `acknowledgePartialAttendance`, `version` }.
     - 제안 만들기는 `createLiveProposal()` → `POST /api/scheduling/teams/{teamId}` { text, referenceDate, searchWindow, **responseDeadline, materialDeadline** }. 마감 두 개는 꼭 화면에서 정해 보내요 (응답 마감 > 지금, 응답 마감 < 자료 마감, +09:00 붙이기). 아직 이 함수를 부르는 화면은 없어요 (대화방 실제 연결 때).
   - **남은 것**: ① 팀이 `supabase/c-scheduling-review.sql`을 검토하고 Supabase에 적용 ② 실제 팀(A 팀 만들기 연결)에서 제안을 만들어 응답·장소·확정 확인 ③ 서버 설정 `SCHEDULE_LIVE_AI_ENABLED=true`, `SCHEDULE_LIVE_PLACES_ENABLED=true` (기본 꺼짐, 무료 사용량 확인 뒤 켜기) ④ 대화방 '@AI'에서 C 제안 만들기(`POST /api/scheduling/teams/{teamId}`, 응답 마감 입력 필요)와 대화방 카드·홈에서 실제 제안 열기.
   - 지우님 묶음 설명: `just_keeping`의 `share/jiwoo-c-code`(`a9c6fb0`) `jiwoo_C_code/integration/syncle-web/README.md`.
   - 이전 메모: 지우님이 우리 앱용 연결 묶음을 만들었어요 → `just_keeping`의 `share/jiwoo-c-code`(`a9c6fb0`) `jiwoo_C_code/integration/syncle-web/` (README에 형식 정리). `/api/scheduling/*` 라우트, `src/server/scheduling`, `src/features/scheduling`, C 저장 SQL(`c-scheduling-review.sql`, **검토용·미적용**). 우리 `main`(`a035210`) 기준이라 `integration/b-d`에는 비교하며 합쳐야 해요. 실제 제안의 6번은 C `POST /api/scheduling/proposals/{id}/places`(`searchAreas` 1~3곳 = 우리 지역 찾기의 역 이름)로 찾고, 그 결과의 장소 ID로만 확정할 수 있어요 (아니면 `C_PLACE_REQUIRED`).
   - 예전 메모: `src/server/c/features/proposals/proposal-flow.ts`(castVote, confirmProposal)와 `meeting-calendar.ts`(.ics)는 들어왔지만 화면과 연결 전이에요. 지금 5의 응답·확정은 브라우저 예시 상태(demo-store)예요.
   - 순서: A 기본 DB → C 저장 SQL 검토·적용 → 화면을 API에 연결. 그래야 팀원끼리 실제로 공유돼요.
   - 예시 제안의 확정은 `ConfirmRequest`(`src/types.ts`)를 만들어 `data.ts`의 `confirmProposal()`(저장 안 함)에 넘겨요. 실제 제안은 C 화면이 C 확정 API를 바로 불러요.
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
- **지우님 (C)** — C SQL 확인 부탁: 확정할 때 `c_schedule_action('confirm')`이 `messages`에 확정 카드를 직접 넣어요 (security definer). 현서님은 확정 메시지를 `create_confirmed_message`(방장 확인)로만 만들자고 했어요 → 둘 중 어느 쪽으로 할지 현서님과 맞추기.
- **지우님 (C)** — 11/6 답변으로 정리됨
  - C의 장소 부분은 따로 알고리즘이 아니라 D `findPlaces`를 부르고 결과를 저장하는 연결부라 그대로 둬요.
  - 장소는 **6 장소 화면을 써요**. 앱은 선택한 시간 후보 ID와 장소 ID를 C 확정 API에 넘겨요 (위 6장 2번, 앱 쪽 준비 끝).
  - C가 고칠 것: '모든 시간 후보마다 장소 찾기' 반복 → **선택한 시간 기준으로 한 번** 호출. 고친 코드를 받으면 `src/server/c`만 바꿔 끼우고 `proposal-adapter.ts`를 확인해요 (지금은 `findPlaces: async () => []`로 넘겨요).
  - C가 고칠 것: **응답 마감**을 제안 만들 때 입력받아 저장. 받으면 `proposal-adapter.ts`가 기존 예시 마감(11/6 21:00) 대신 그 값을 쓰게 바꿔요.
  - 남은 확인: C의 `confirmProposal`은 지금 장소를 C의 `placeGroups`에서 찾아요. 6에서 고른 장소 ID를 받도록 바뀌는지 같이 확인해요.
- **현서님 (A)**: 6장 1번

---

## 8. 작업할 때 주의

- 규칙: 색·글꼴은 `src/app/globals.css` 토큰만, 모든 화면은 휴대폰 한 화면(390×844) 안에, 데이터는 `src/lib/data.ts` 함수로만.
- 배포용 빌드(`npm run build`)는 개발 서버가 켜져 있으면 `.next` 폴더가 꼬일 수 있어요. 개발 서버를 끄거나 다른 폴더 사본에서 돌려요.
- 카카오 로컬 API 응답은 따로 저장해 쓰면 안 돼요 (카카오 약관). 사용자가 고른 출발지를 프로필에 저장하는 건 약관을 한 번 확인하기.
- 데모 상태는 브라우저 탭에만 저장돼요. `/screens` 맨 아래 '처음 상태로 되돌리기'로 초기화해요.
