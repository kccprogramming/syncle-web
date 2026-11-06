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

### 지금 어디까지 왔나 (11/6 밤)

로그인하면 **진짜 데이터로 처음부터 끝까지** 돼요 (두 계정으로 확인):
Google 로그인 → 내 정보(출발지 · 매주 안 되는 시간 · 알림 설정) → 팀 만들기 · 초대 링크 참여 → 팀 설정(이름 · AI · 방장 넘기기 · 나가기) → 실시간 대화 · 사진 · 파일 · 할 일 → '@AI 회의 잡아줘'(B Gemini) → C 제안 저장 → 시간 응답 → 공평한 지역 · 장소(D) → 방장 확정 → 대화방 확정 카드 · 홈 다가오는 회의 → 앱 알림(🔔).
11/6 밤 추가: 8 확정 회의 카드(Google 캘린더 추가) · 9 AI 회의록 · 7 내 조건 · 대화방 '@AI 요약 · 할 일 · 자료 정리' 카드도 진짜 데이터로 돼요 (희원 확인). B 장소 종류(합주실 등)가 C 저장 → 장소 찾기까지 끝까지 전달돼요. Vercel 미리보기에서도 로그인 · 제안 만들기 확인.
**11/6 늦은 밤 (팀원 미리보기 피드백 반영, 희원 확인)**: '@AI 요약 · 할 일 · 자료' 카드를 팀원 모두에게 공유(대화 순서대로) · 위쪽을 읽는 중이면 새 메시지에 안 내려가고 '새 메시지 N개 ↓' · '나에게만' 질문 카드 대신 제안 카드 하나 · 방장의 팀원 내보내기(SQL `a-remove-team-member.sql` 실행함) · 팀 설정 '생성일 26/11/6' · 출발지 없는 팀원은 빼고 장소 순위 · 5 장소 칸 '찾은 지역 ○○역 외 2곳 펼치기 ▾'(펼치면 지역 전체 · 찾는 장소 태그 · 팀원별 출발 동네) · 시트 버튼 납작해짐 수정. 마지막 점검: 타입 검사 · C 테스트 15개 · 배포용 빌드 · 미리보기 주요 화면 모두 통과.
로그인 안 하면 예전 가짜 데이터 데모 그대로예요. 자세한 내용은 6장.

### 다음에 할 일 (새 대화는 여기부터)

1. **답 기다리는 중 (11/6 밤 전달함)**
   - 성하님(B): **`c6e07ed`로 해결 · 통합본 반영함** (앱 카드를 요청 종류 하나로 · 근거 인용 검사 · 지어내기 금지, 테스트 196개 통과, 타입도 고침). 남은 것은 회의 조건의 `origins` 검사(앱이 빠진 팀원을 채우는 중) 정도.
   - 지우님(C): 한밤중 시간 후보 → **`9834b43`로 해결 (매일 회의 가능 시간 `meetingHours`, 기본 09:00~22:00) · 통합본 반영함**. Supabase에 고친 `supabase/c-place-type-migration.sql` **실행함 (11/6 희원)**. 남은 확인: 실제 계정으로 대면 제안을 새로 만들어 장소 종류 · 시간 후보(09:00~22:00 안) · 장소 찾기 보기 (이미 00:00에 확정된 회의는 그대로).
   - (11/6 결정) 장소 순위의 '출발지 없는 팀원 빼고 계산', 팀원 내보내기 SQL(`a-remove-team-member.sql`), 비공개 메시지는 앱에서 거르는 방식 — **지금 그대로 두기로 함** (팀원에게 따로 묻지 않음).
   - 답이 오면 `just_keeping`에서 가져와 `src/server/b` · C 파일만 바꿔 끼우고 테스트(4장 방법).
2. **미리보기 팀원에게 열어 전달함 (11/6 희원)**: Vercel Authentication을 꺼서 링크로 누구나 열고 각자 Google로 로그인해 써 볼 수 있어요. 주소: `https://syncle-web-git-integration-b-d-unione1.vercel.app` (`integration/b-d`의 최신 배포, 로그인 없이 열리는 것 · 카카오 장소 검색 확인). 팀원 의견이 오면 반영.
3. **push 뒤 미리보기가 안 생기면**: Vercel이 GitHub push를 놓친 적이 있어요(11/6 `bcec398`). Deployments → `⋯` → Create Deployment → `integration/b-d`, 또는 Settings → Git → Deploy Hooks의 `b-d` 훅 주소를 POST (주소는 비밀이라 문서에 안 적어요 · 희원이 가지고 있음).
4. `integration/b-d` → `final` 저장소 (팀 확인 뒤).

### `integration/b-d` 커밋 (오래된 것부터)

1. `6cca425` B·D 백엔드 연결
2. `bf0b7df` 6에서 장소 종류 고르기 + 2-1에서 팀원이 직접 출발지 정하기
3. `0e100d1` AI가 대화를 보고 장소 종류(합주실·회식 장소 …) 정하기
4. `6e2faf6` 공평한 지역 찾기 + 팀 추천 기준 + 지역별 추천 이유
5. `868c7ae` C(시간 후보 · 회의 제안) 합치기
6. 11/6: `5bf4c5a` Google 로그인 · `e022f44` 내 정보 저장 · `391436b` C 실제 일정 합치기 · `d83d815` 팀 · `9a06a05` 실시간 대화 · `1bb49cf`/`e3d82a9` 사진 · 파일 · `da6477f` 할 일 · `9607d21` 팀 설정 · 화면 고정 · `f091390` C 끝까지 · `0e7e99e` 홈 다가오는 회의 · `c95b731` 알림

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
  4. (11/6 밤 추가) 출발지가 없어 이동시간을 **모르는 팀원은 빼고** 아는 사람(2명 이상)끼리 비교해요. 모르는 사람이 있는 장소는 모두 아는 장소보다 뒤. 예전엔 한 명만 몰라도 모든 장소가 '순위 제외'돼서 확정을 못 했어요 → `src/features/scheduling/rank-places-team-rule.ts`, `tests/c-places.test.ts` (C 테스트 '미확인은 순위 없음'도 새 규칙으로 바꿨어요)
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

받은 코드에서 바꾼 것: 각 파일 끝의 단독 실행 예시(`if (import.meta.main) {…}`) 삭제, C의 `shared/b-c-contract.ts`를 B 최신 규격으로 연결, D `resolveOrigin.ts`의 `points` 변수에 타입 한 줄(우리 TypeScript 설정에서 오류가 나서, 동작은 그대로).

B 최신(`placeType` 필수)에 맞춰 연결 쪽에서 고친 것: C `src/server/scheduling/service.ts`(조건에 `placeType` 넣기 · B의 새 `card` 응답이면 제안을 만들지 않고 돌려주기), `tests/c-flow.test.ts`(`placeType: null`), `ai-adapter.ts`(`card` → 대화방 답 카드), `place-intent.ts`의 `placeIntentFrom`(B `placeType`을 먼저 쓰고 없으면 낱말 규칙). **11/6 밤 지우님 `de98361` 반영**: C가 대면 회의의 `placeType`을 저장하고(`safeConditions`, SQL `safe_conditions`), 방장이 검색어를 바꾸지 않으면 저장된 `placeType`으로 D 장소를 찾아요. **Supabase에 `supabase/c-place-type-migration.sql`을 한 번 실행해야** 실제 DB에 저장돼요 (안 하면 예전처럼 버려지고 낱말 규칙으로 찾아요).

---

## 4. 팀원 원본 위치 (`kccprogramming/just_keeping`)

| 담당 | 브랜치 | 가져온 커밋 |
|---|---|---|
| A 현서 | `a-hyunseo/feature-code` → `contributions/a-hyunseo/` ([PR #2](https://github.com/kccprogramming/just_keeping/pull/2), 열림) | 아직 안 가져옴 |
| B 성하 | `share/sungha-b-final` → `sungha_B_code/` | `c6e07ed` (11/6 밤 · 앱 카드 검사 · 근거 인용, 시간 다듬기). 받은 그대로 — 테스트 파일 · `schedule.ts` · `check-ai.ts`는 안 가져옴 |
| C 지우 | `share/jiwoo-c-code` → `jiwoo_C_code/` | `f482f55` (예시 흐름), `a9c6fb0`의 `integration/syncle-web/` (실제 저장), SQL `55ec72e`, `de98361`(placeType), `9834b43`(매일 회의 가능 시간 · 11/6 밤 — 우리 통합본은 `meetingHours`를 B 계약 대신 `src/features/scheduling/types.ts`에서 더함) |
| D 현규 | `feature/d-place-recommendation` → `D_HANDOFF/` | `4a829da` (11/6, 이전 `2426bba`) — `getWalkingRoute.ts`, `C_INTEGRATION_GUIDE.md` 추가 |

팀원이 코드를 고치면 해당 폴더(`src/server/b|c|d`)만 새 버전으로 바꿔 끼우고, 연결 파일이 깨지는지 확인하면 돼요.

---

## 5. 키 · 환경 설정

| 이름 | 어디에 | 없으면 |
|---|---|---|
| `KAKAO_REST_API_KEY` | `.env.local` + Vercel 환경 변수 (이미 넣음) | 장소 검색·추천이 예시 데이터로 동작 |
| `GEMINI_API_KEY` | `.env.local` + Vercel (넣음, 11/6 확인) | 데모 흐름은 예시 조건, 진짜 팀 제안 만들기는 안 돼요 |
| `SCHEDULE_LIVE_AI_ENABLED` · `SCHEDULE_LIVE_PLACES_ENABLED` | `.env.local` + Vercel (`true`, 11/6 확인) | 진짜 팀의 제안 만들기 · 장소 찾기가 막혀요 (C 서버 스위치) |
| `GEMINI_MODEL` | 선택 | B 기본값 `gemini-2.5-flash` (11/6 B 최신부터, 이전 `gemini-3.1-flash-lite`) |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel (넣음) | 로그인 · 진짜 데이터가 안 되고 예전 데모로 움직여요 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` + Vercel (넣음, 채팅으로 안 보내요) | 〃 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 `.env.local` + Vercel만 (넣음, 브라우저·GitHub 금지) | 회원 탈퇴, 팀원 출발지 읽기(005)가 안 돼요 |

- Vercel 환경 변수는 7개 모두 Production · Preview에 들어 있어요 (11/6 확인). `SUPABASE_SERVICE_ROLE_KEY` · `GEMINI_API_KEY`에 붙은 'Needs Attention'은 "비밀값 같으니 Secret으로 저장하라"는 권고예요 (지금 동작에는 상관없음).
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
   - **사진 · 파일 올리기 (11/6)**: 4 + 메뉴는 사진 · 파일 · 할 일 · AI로 회의 잡기 4개 (투표 · 링크는 뺌, AI 회의 잡기 강조 없앰). 진짜 팀이면 `uploadTeamFile`이 비공개 보관함 `team-materials`의 `팀ID/내ID/무작위.확장자`에 올리고(20MB 제한), 대화방에 `📎 이름 · 크기` 메시지를 남기고, `team_materials`에 그 메시지(`source_message_id`)와 이어서 저장해요. 사진은 대화방에서 사진으로 보여요(`teamImageUrls`, 1시간짜리 서명 주소), 다른 파일은 📎 말풍선 → 누르면 새 탭으로 열려요. 고르면 시트가 바로 닫히고 대화방에 '올리는 중…' 말풍선(사진은 흐린 미리보기)이 먼저 떠요. '올리는 중' 표시는 누른 버튼(사진/파일)에만.
   - **팀 메뉴 · 전체 보기의 사진 · 자료 (11/6)**: 진짜 팀이면 `loadTeamMaterials`로 팀 자료를 읽어요 (메뉴를 열 때마다 새로). 팀 메뉴에 '사진' 칸(썸네일 8장)과 '자료' 칸(사진 아닌 파일 3개), 전체 보기에 '사진' 탭(3칸 격자) 추가. 누르면 `materialUrl`로 새 탭에서 열려요.
   - **할 일 연결 (11/6)**: `loadTeamTasks` · `createTeamTask`(다른 팀원에게 맡기면 `create_team_notification` 알림, A /api/tasks와 같게) · `setTaskDone`. + 메뉴 '할 일'과 전체 보기 할 일 탭의 '+ 할 일 추가'가 `TaskSheet`(무엇을 · 누가 · 언제까지)를 열어요. 팀 메뉴는 안 끝난 할 일, 전체 보기는 내 할 일 / 팀 할 일. 체크는 바로 저장(실패하면 되돌림). A의 API 대신 같은 규칙(RLS)으로 테이블을 바로 써요.
   - **팀 설정 (11/6)**: 진짜 팀이면 이름 · AI 도우미 · AI가 읽는 범위(`updateTeam`, **방장만** — 권한 없으면 0줄이 바뀌는 걸로 알아채요), 방장 넘기기(`transfer_team_owner`), 팀 나가기(`leave_team`). 팀 메뉴의 AI 스위치도 저장돼요. **혼자 남은 방장이 나가면 A가 팀을 통째로 지워요** → 확인 시트에서 "팀 지우고 나가기"로 분명히 알리고, 나간 뒤 정말 빠졌는지 다시 확인해요.
   - **팀원 내보내기 (11/6 밤)**: 팀 설정의 팀원 줄 '내보내기'(방장에게만, 나는 빼고) → 확인 시트 → `removeTeamMember` → A에 없는 함수라 **새 SQL `supabase/a-remove-team-member.sql`(`remove_team_member`, 방장만 · 나 자신 안 됨)을 Supabase에서 한 번 실행해야 해요**. 내보낸 뒤 대화방에 '방장이 ○○님을 팀에서 내보냈어요' 한 줄(`notice`). 그 사람이 쓴 대화 · 자료 · 할 일은 남고, 이미 만든 C 제안의 팀원 목록에는 남아요.
   - **내 정보 이름 (11/6)**: '이름 수정' 시트 → `saveMyNickname`(`profiles.nickname`, 팀원에게 보이는 이름). 화면 이름은 nickname → 없으면 Google 이름. 실패하면 이전 이름으로 되돌려요.
   - **회원 탈퇴: 뺐어요 (11/6 결정)**. 1-1의 '회원 탈퇴' 버튼도 없앴어요. 다시 넣는다면: A `DELETE /api/account`(PR #2)를 옮기되 ① 파일 정리는 계정 삭제 **뒤에**(파일 목록은 먼저 적어 두기) ② C 테이블 `scheduling.responses.member_id`, `scheduling.proposals.created_by`가 `auth.users`를 삭제 규칙 없이 가리켜서 제안·응답한 사람은 계정 삭제가 막혀요 → 지우님과 `on delete cascade` / `set null` 먼저 정하기.
   - **장소 종류 끝까지 전달 (11/6 밤, 지우님 요청)**: B `placeType` → C 제안 저장 → 5 화면 '찾을 장소' 기본값 → C 장소 찾기 검색어. 5 화면(`LiveProposal`)의 검색어 기본값이 예전엔 `스터디룸`이라 저장된 B 값을 덮어쓸 수 있었어요 → 기본값을 저장된 `placeType`으로 바꾸고, **방장이 바꾸지 않았으면 검색어를 보내지 않아요**(C가 저장값 사용). 지역 추천(`/api/places/areas`)도 `placeType`을 그대로 검색어로 써요(`placeIntentFrom`). 테스트: 지우님 DB 테스트(대면 저장 · 온라인 거절) 포함 C 13개 통과. **남은 것**: Supabase에 `c-place-type-migration.sql` 실행 → 실제 계정으로 대면 제안 만들기 → 5 화면 '…에서 ○○ 찾기'가 B 장소 종류인지 → 장소 찾기 결과 확인.
   - **날짜 · 시간 고르기 통일 (11/6 밤)**: 브라우저 기본 날짜 · 시간 입력을 모두 앱 시트로 바꿨어요 — `TimeWheelSheet`(시 · 분 휠, '22 : 00') · `DatePickerSheet`(달력 + 필요하면 같은 휠). 제안 만들기(기간 · 응답 마감 · 자료 마감 · 회의 가능 시간), 내 조건의 조건 추가, 다른 시간 알려주기, 할 일 마감. 시트 안에서 여는 시트는 겹치지 않게 바깥 시트 옆에 그려요(`.sheet`가 absolute라서).
   - **매일 회의 가능 시간 (11/6 밤, 지우님 `9834b43`)**: 제안 만들기 시트의 접힌 칸에 '매일 회의 가능한 시간'(기본 09:00~22:00, 30분 단위, 시작이 끝보다 늦어지지 않게 막음) → `createLiveProposal`의 `meetingHours`. C는 이 안에서 시작하고 끝나는 후보만 만들고, '다른 시간 알려주기'도 이 밖이면 막아요. 회의 길이보다 짧으면 시트에서 막아요. C 테스트 15개 통과.
   - **화면 다듬기 (11/6 밤)**: 제안 만들기 시트의 목적 기본값을 '@AI 합주 잡아줘' → "합주"처럼 부탁한 내용으로(팀 이름을 넣으면 B가 장소 종류를 '회의 장소'로 고를 수 있었음, `purposeFromRequest`). `@ai` 소문자도 AI 호출로 알아들음. 5 화면 장소 칸: '○/○ ○○:00 기준 · 지역 · 장소 종류' 칸 + '시간 바꾸기' 버튼, 결과 아래 '지역 · 장소 종류 바꿔서 다시 찾기', 찾는 동안 버튼을 회색으로 바꾸지 않음. 확정 칸 버튼은 세로로(주 버튼 '회의 카드 보기' 하나). Gemini 사용량 한도(429)면 "AI 사용량이 잠시 많아요 · 1분 뒤 다시 부탁해 주세요"(`isAiBusy`).
   - **남은 데모 화면 연결 (11/6 밤)**: 진짜 ID(UUID)면 새 화면, 데모 ID(`m-1`, `p-1`)면 예전 데모 그대로.
     - **대화방 '@AI 요약 · 할 일 정리 · 자료 정리'**: `POST /api/teams/{teamId}/ai`(`src/server/team-ai.ts`) → B `handleAiRequest`(앱 카드) → `cardReply`(`ai-adapter.ts`) → 대화방 답 카드. 대화는 부른 사람 권한으로 읽고(비공개 · AI 꺼짐 · @AI만 읽기 지킴), 답 카드는 대화방 메시지(`notice`, JSON `{type:"ai_reply"}`)로 저장돼 **팀원 모두에게** 실시간으로 보이고 'OO님 부탁'이 붙어요 (11/6 밤 `postAiReplyCard`, 미리보기에서 두 계정으로 확인. B는 `general`만 읽어서 AI가 자기 카드를 다시 읽지 않아요, 글 속 `/`는 `\/`로 적어 A 링크 자동 저장에 안 걸려요). '정리 중' · 실패 안내는 내 화면에만, 부탁한 메시지 바로 아래에 고정(뒤에 온 메시지는 그 아래로). 할 일 카드는 줄마다 '+ 추가' → `createTeamTask`(담당자 알림). B의 앱 카드 프롬프트에 '요청 종류'가 없어서 앱이 요청 종류 · 오늘 날짜 · 팀원 이름/id · 근거 형식을 덧붙여요 (7장 성하님).
     - **8 확정 회의 카드** `/meetings/{제안 ID}` (`LiveMeeting.tsx`): C 제안의 확정 시간 · 장소 · 참석자 · 안건 · 내 대중교통 시간(장소 찾기 결과) · 캘린더(`CalendarSheet`: Google 캘린더 '일정 추가' 화면을 새 탭으로 → 로그인된 Google 계정에 저장만 누르면 됨, 앱은 캘린더 권한을 받지 않음 / 다른 앱은 .ics) · 길찾기 · 장소 사이트 예약 / 온라인이면 회의 들어가기. '참석이 어려워요'는 대화방에 한 줄(이유는 안 남김). 홈 · 대화방 확정 카드 · 팀 메뉴 회의 · 5 확정 화면의 '회의 카드 보기'가 여기로 와요.
     - **9 회의록** `/meetings/{제안 ID}/minutes` (`LiveMinutes.tsx`): 회의 메모(선택) + 회의 시간 앞뒤 30분 대화 → B 회의록 카드 → 요약 · 정한 것 · 할 일(골라서 팀 할 일 추가). 회의록은 저장하지 않고 '대화방에 올리기'로 남겨요. 녹음은 범위 밖.
     - **7 내 조건** `/proposals/{제안 ID}/conditions` (`LiveConditions.tsx`): AI가 이해한 내 시간(C 조건의 나) · 내 응답 · 매주 안 되는 시간(내 정보) · 출발 위치(바로 수정). '+ 이번 회의 조건 추가' → C `condition`(안 돼요 · 되면 좋아요, 찾는 기간 안). 5 화면 아래 'AI가 이해한 내 조건 보기 ›'로 들어가요.
   - **알림 (11/6)**: 1-2 알림은 `loadMyNotifications`(A `app_notifications`, 최근 100개), 하나 열면 그것만 · '모두 읽음'은 전부 `markNotificationsRead`. 홈 🔔은 `countUnreadNotifications` + `subscribeMyNotifications`(실시간). 지금 생기는 알림: `task_assigned`(할 일 배정 → 그 팀 할 일 탭), `meeting_response`(C '다시 알림' → 제안 화면). 실제 두 계정으로 확인.
   - **대화방 스크롤 (11/6 밤)**: 맨 아래를 보고 있을 때만 새 메시지를 따라 내려가요. 위쪽을 읽는 중이면 그대로 두고 '새 메시지 N개 ↓' 버튼(누르면 맨 아래로). 내가 보낸 메시지 · AI 정리 중은 항상 내려가요.
   - **데모를 실제 화면으로 (11/6 밤)**: 로그인 없는 데모 제안 p-1(응답 중) · m-1(확정) · m-0(지난 회의)도 실제 화면(`LiveProposal` · `LiveMeeting` · `LiveMinutes` · `LiveConditions`)으로 그려요. `src/lib/demo-scheduling.ts`가 C 일정 API 대신 예시 데이터를 돌려주고(계산은 실제와 같은 `projectProposal` · `combineRegionPlaces`), 응답 · 장소 찾기 · 확정은 그 탭에만 저장(sessionStorage)돼요. 날짜는 오늘 기준. `data.ts`는 데모 팀(UUID가 아닌 ID)이면 DB 대신 예시로 답해요(`askTeamAi` 회의록 · `sendTeamMessage` · `createTeamTask` · `loadTeam` · `loadTeamMembers` · `loadMemberNeighborhoods`). 데모 대화방 카드도 실제 카드(`LiveCard`) 모양, '나에게만' 질문 카드는 뺌. 발표 QR이 이 데모(`/teams/hci4`)로 열려요.
   - 화면 크기: 컴퓨터(500px 이상)에서는 휴대폰 화면 높이를 `min(844px, 창 높이 − 32px)`로 고정하고 페이지 스크롤을 막아요. 화면 안(`.screen__body`)만 스크롤.
   - 팀 메뉴 · 전체 보기의 회의는 진짜 팀이면 `loadTeamProposals`(c_schedule_list)로 보여줘요. 대화방 '@AI 회의 잡아줘' → C 제안 만들기도 연결 끝 (아래 2번).
   - 팀원 출발지: D 계산용 정확한 출발지는 `profile_private_locations`에 있고, 서버만 `get_team_private_origins_for_calculation`(005, service role 키)으로 읽어요. 브라우저에서 부르지 않아요.
   - `src/lib/data.ts`의 함수 안쪽만 API 호출로 바꿔요 (각 함수 위에 담당·API 주소 주석). `saveMyOrigin`이 출발지 저장 자리예요
   - `src/mocks/member-origins.json`(팀원 출발지 임시값)과 `demo-store`의 서버 저장 대상(확정, 응답, 출발지, 할 일)을 A API로 바꾸기
2. **C 실제 일정 — 끝까지 동작 확인 (11/6)**: 지우님 SQL `55ec72e`를 kcc에 적용(A 006은 실행 안 함). 실제 두 계정으로 제안 만들기 → 응답 → 장소 찾기 → 방장 확정 → 새로고침까지 확인 (KCC해커톤 '회의' 11/10(화) 16:00 · 서울역 삼경교육센터, 대화방 확정 카드는 A `create_confirmed_message`로).
   - 켜야 하는 서버 설정: `GEMINI_API_KEY`, `SCHEDULE_LIVE_AI_ENABLED=true`, `SCHEDULE_LIVE_PLACES_ENABLED=true` (`.env.example` 설명).
   - 제안 만들기: 대화방 '@AI … 잡아줘' → `CreateProposalSheet`(목적 · 길이 · 대면/온라인 + 접힌 기간 · 응답 마감 · 자료 마감). 누르면 '@AI 회의 잡아줘 · 목적 … · 1시간 · 대면으로' 메시지를 남긴 뒤 `createLiveProposal` (B가 목적 · 길이를 다시 묻지 않게). 기간 끝은 다음 날 0시. 만들어지면 앱이 `ai_proposal` 카드를 남겨요(C는 공개 카드를 안 남김).
   - 대화방 카드(`live-card`): 제안(응답 중) · 확정 · 나에게만 온 질문 → 누르면 C 화면. **11/6 밤**: A 규칙(RLS)은 비공개 메시지를 보낸 사람에게도 보여줘서, 제안을 만든 사람에게 다른 팀원의 '나에게만' 질문이 여러 장 보였어요 → 앱이 `visible_to`에 내가 없으면 빼요(`notForMe`, 읽기 · 실시간 둘 다). 또 C 확인 질문은 B가 시간을 모르는 팀원에게만 가서 사람마다 0~1장으로 달라 보여서, **대화방에서는 확인 질문 카드를 아예 빼고** 모두 같은 제안 카드('되는 시간 고르기')로 응답해요 (홈 마지막 메시지에서도 뺌). 팀 메뉴 · 전체 보기 '회의'는 `loadTeamProposals`(c_schedule_list).
   - C 화면(`LiveProposal`)을 5번 모양으로 다시 그림: 시간 카드를 누르면 바로 '나 돼요' 체크 → 0.6초 뒤 `/respond` 저장(version 포함), '다 안 돼요', '후보에 맞는 시간이 없나요? · 다른 시간 알려주기'(custom 응답 + 이번 회의 조건). 방장의 확정할 시간은 된다고 한 사람이 가장 많은 시간으로 자동(장소 카드 '시간 바꾸기'). 장소는 '이 시간의 장소 찾기'가 팀원 출발지 가운데 역 3곳(`/api/places/areas`)을 그 자리에서 구해 바로 찾고, 못 구하면 `AreaPickerSheet`(카카오 위치 검색으로 최대 3곳). 장소 카드에 사람별 대중교통 시간. 확정 버튼 위에 못 누르는 이유.
   - 홈 '다가오는 회의': `loadUpcoming`이 내 팀들의 C 제안을 모아 확정 회의(끝나지 않은 것, 초록) + 응답 중 제안(파랑, '내 응답 필요'면 위로)을 보여줘요.
   - 출발지 확인: 출발지를 고를 때 `/api/places/check-origin`(D `resolveOrigin`)으로 위치를 정할 수 있는지 확인하고, 안 되면 막아요('구로역광장'처럼 동네까지만 있는 주소 → 가운데 지역을 못 구했던 원인). 저장은 번지 있는 주소를 먼저.
   - 이전 기록 (코드 합친 방법):
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
   - (예전 '남은 것' ①~④ — C SQL 적용, 실제 팀에서 응답 · 장소 · 확정, 서버 스위치 켜기(`.env.local`), 대화방 '@AI' 제안 만들기 · 카드 · 홈 — 은 11/6에 모두 끝났어요.)
   - 지우님 묶음 설명: `just_keeping`의 `share/jiwoo-c-code`(`a9c6fb0`) `jiwoo_C_code/integration/syncle-web/README.md`.
   - 이전 메모: 지우님이 우리 앱용 연결 묶음을 만들었어요 → `just_keeping`의 `share/jiwoo-c-code`(`a9c6fb0`) `jiwoo_C_code/integration/syncle-web/` (README에 형식 정리). `/api/scheduling/*` 라우트, `src/server/scheduling`, `src/features/scheduling`, C 저장 SQL(`c-scheduling-review.sql`, **검토용·미적용**). 우리 `main`(`a035210`) 기준이라 `integration/b-d`에는 비교하며 합쳐야 해요. 실제 제안의 6번은 C `POST /api/scheduling/proposals/{id}/places`(`searchAreas` 1~3곳 = 우리 지역 찾기의 역 이름)로 찾고, 그 결과의 장소 ID로만 확정할 수 있어요 (아니면 `C_PLACE_REQUIRED`).
   - 예전 메모: `src/server/c/features/proposals/proposal-flow.ts`(castVote, confirmProposal)와 `meeting-calendar.ts`(.ics)는 들어왔지만 화면과 연결 전이에요. 지금 5의 응답·확정은 브라우저 예시 상태(demo-store)예요.
   - 순서: A 기본 DB → C 저장 SQL 검토·적용 → 화면을 API에 연결. 그래야 팀원끼리 실제로 공유돼요.
   - 예시 제안의 확정은 `ConfirmRequest`(`src/types.ts`)를 만들어 `data.ts`의 `confirmProposal()`(저장 안 함)에 넘겨요. 실제 제안은 C 화면이 C 확정 API를 바로 불러요.
3. **Gemini 키로 B 실제 확인 — 완료 (11/6)**: `.env.local`에 `GEMINI_API_KEY`(희원 계정, Google AI Studio 무료) 넣고 실제 제안까지 확인. Vercel에도 넣어야 해요.
4. **`integration/b-d` → `final`**: 팀 확인 뒤 최종 저장소로 옮기기.

---

## 7. 팀원에게 전달할 것

- **성하님 (B) — 11/6 밤 `c6e07ed` 받음**: 앱 카드가 요청한 종류 하나만 만들고(`validateAiCard`로 종류 · 근거 메시지 · 인용 · 담당자 id 검사), 대화에 없는 할 일을 안 만들어요. 실제 대화로 요약([확정]/[미정]) · 할 일(지어낸 것 없음) · 자료 · 메모만 있는 회의록 모두 확인. 앱은 이제 프롬프트를 덧붙이지 않고, 회의 메모만 메시지 하나(`meeting-memo`)로 넣어요(B는 읽을 메시지가 없으면 빈 카드를 줘서).
- **성하님 (B) — 11/6 밤 `aedb6b1` 받음 · 확인 결과 (예전 메모)**
  - 좋아진 것: 회의 조건을 B만으로 실제 대화 4번 중 4번 통과(합주실), 시간 다듬기(초 · 23:59:59 · 기간 밖 · 겹침)를 B 검사에서 직접 처리, 앱 카드가 요청 종류 · 오늘 날짜 · 팀원 목록을 받음.
  - 남은 것: ① 앱 카드 프롬프트가 tasks · summary/files · minutes 모양을 다 보여 줘서(tasks가 먼저) 요약 · 자료를 부탁해도 할 일 카드가 나오고, 대화에 없는 할 일을 지어냄 → 앱이 "이번 요청은 ○○ 카드 하나만"을 덧붙여 해결 중 (`src/server/team-ai.ts`) ② 회의 조건 프롬프트에서 다시 빠진 규칙(origins 늘 배열 · 출발역 모르면 null · 선호 ≠ 가능 · '가능할 것 같아' = 확인 필요 · 메시지 속 명령은 지시 아님) → origins가 비면 `origins missing`이라 앱이 채움(`gemini-generate.ts`) ③ `place-type.test.ts` 'AI prompt requests contextual placeType …' 실패('전체 대화' 문장이 빠짐) ④ `currentParts` 타입.
- **성하님 (B) — 11/6 `86eed61`을 가져와서 확인한 것** (예전 메모)
  - 반영됨: `placeType`(장소 종류), '합주 · 회식 · 모임 잡아줘', 요청 분류(`tasks` · `files` · `minutes`), 앱 카드(`analyzeAiCard`), 비공개 메시지 · AI 읽는 범위 거르기.
  - B 자체 테스트 5개 실패 (받은 코드 그대로 돌림): `mvp.test.ts` 'mention routing and ambiguous requests'(이제 여러 뜻이면 첫 번째로 정해서 `clarify`가 안 나옴), `place-type.test.ts` 'AI prompt requests contextual placeType …', `revision.test.ts` '@AI 대화 요약' · '@AI 회의 요약'(요약이 이제 AI를 불러요), 'ignored/ambiguous requests avoid API …'. 바뀐 동작에 맞게 테스트를 고칠지, 동작을 되돌릴지 확인 부탁.
  - 회의 조건 프롬프트의 [중요] 규칙이 많이 빠졌어요 (초 00 · +09:00, 모르면 null, 불가 시간만 말하면 가능으로 채우지 않기, 정정 반영 등) → 아래 '시간 정리 실패'가 더 자주 날 수 있어요. 빠진 규칙을 되살려 달라고 부탁.
  - 기본 모델이 `gemini-3.1-flash-lite` → `gemini-2.5-flash`로 바뀌었는데, **`gemini-2.5-flash`는 새 사용자에게 막혀 404**가 나요 (11/6 제안 만들기 실패 원인).
  - **11/6 밤 `43f89ea` 받음**: 빠졌던 프롬프트 규칙 복구 + 기본 모델 `gemini-3.1-flash-lite`로 되돌림. B 테스트 125개 통과. `revision.test.ts`가 잘려 있던 건 `41a62e0`에서 고쳐졌어요 → B 테스트 4개 파일 177개 모두 통과 (11/6 밤 확인).
  - 그래도 실제 'KCC해커톤' 대화로 B만 돌리면 4번 중 1번만 통과 (`23:59:59`, 찾는 기간 밖 11/15 시간, 되는/안 되는 시간 겹침). 앱 보정(아래 ②~⑤)을 거치면 8번 중 8번 통과.
  - **앱 쪽 임시 해결 (11/6)**: B를 부를 때 `src/server/gemini-generate.ts`의 `geminiGenerate`를 넘겨요 (`handleAiRequest(text, input, geminiGenerate)`, C 제안 만들기 · `/api/ai/request` 둘 다). ① 모델 기본값 `gemini-3.1-flash-lite`(`GEMINI_MODEL`로 바꿀 수 있음) ② AI 답의 시각을 분 단위로 맞춤(`23:59:59` → 다음 날 `00:00:00`) ③ `origins`에 빠진 팀원을 `station: null`로 채움 ④ 한 사람의 되는/안 되는 시간이 겹치면 겹친 부분을 되는 시간에서 뺌(안 된다고 한 때에 안 잡게) ⑤ 모든 시간 구간을 찾는 기간 안으로 자름. 실제 'KCC해커톤' 대화로 5번 연속 `ready` 확인. 성하님이 B 검사에서 이런 경우를 오류 대신 다듬거나 확인 질문으로 돌려주면 ②~⑤는 지워도 돼요.
  - 실패 원인은 화면에 안 보이고(C가 '입력 형식과 회의 조건을 확인해 주세요'로 감춰요) 개발 서버 기록에 `[scheduling] request failed: …` 한 줄로 남아요.
  - 아직: '나는 7시 이후' 같은 시간 정리 보완(아래), 앱 카드 `basis`는 메시지 ID 목록이라 앱은 'N개 근거'로만 보여줘요.
  - **(11/6 밤 실제 테스트) 앱 카드 `analyzeAiCard`**: 프롬프트에 '이번에 무슨 요청인지'가 없어서 '할 일 정리해줘'에도 자료 · 일정 카드를 배열로 여러 장 주고, basis가 메시지 id가 아닌 글, 사람은 '사용자 1', 날짜는 2024년으로 나와요. 앱이 프롬프트 끝에 요청 종류 · 오늘 날짜 · 팀원 id=이름 · 담당자는 id로 · basis는 id로를 덧붙여서 해결 중 (`src/server/team-ai.ts`). B에서 `analyzeAiCard(input, kind, …)`처럼 요청 종류와 팀원 이름을 받아 주면 덧붙이는 부분을 뺄 수 있어요.
- **성하님 (B) — AI 기능 전부 (11/6 정리)**. 지금 B는 '회의 잡기'만 돼요. '요약'은 알아듣지만 "아직 준비 중"이고, 할 일 · 자료 · 회의록은 분류도 없어요 ("@AI 할 일 정리해줘"는 '정리' 때문에 요약으로 잘못 분류돼요).
  - 공통: 대화 메시지(+ 필요하면 팀 자료 · 할 일 · 확정 회의)를 받아 **제안만** 돌려주기 (저장은 사람이 '추가'를 눌러야). 결과마다 근거 메시지 ID(`sourceMessageIds`). 팀 설정 'AI 읽는 범위'(`ai_read_scope`: 전체 / @AI만)와 AI 꺼짐 지키기. 비공개 메시지(`visible_to`)는 읽지 않기. 화면 카드 모양은 `src/types.ts`의 `AiReply` { kind, title, basis(무엇을 보고 답했는지), items[{ text, sub, tag }] }에 맞춰 주면 바로 붙어요.
  - **(11/6 실제 테스트에서 발견) 시간 정리 실패**: "나는 7시 이후에 가능해"를 AI가 `11/8 19:00 ~ 11/14 23:59:59` 한 덩어리로 써서 B 검사(`초는 00`, 기간 안)에 걸려요 → C가 "입력 형식과 회의 조건을 확인해 주세요"만 돌려줘요. 부탁: ① AI 출력의 초를 00으로 맞추기(또는 23:59:59 → 다음 날 00:00:00) ② '매일 N시 이후' 같은 반복 시간은 날짜별 구간으로 나누기 ③ 검사에 걸리면 오류 대신 확인 질문(needs_confirmation)으로 돌려주기. 날짜 · 시간을 구체적으로 쓰면("11/10(화) 19:00~22:00 가능") 지금도 통과해요.
  - 요청 분류(`classifyRequest`)에 종류 추가: `tasks`(할 일 정리), `files`(자료 모아줘), `minutes`(회의록 정리). '합주 · 회식 · 모임 잡아줘'도 `schedule`로.
  - ① 회의 잡기 (있음): 출력에 장소 종류(`placeType`) 추가 → `place-intent.ts` 낱말 규칙 대신.
  - ② 대화 요약 (분류만 있음, 출력 없음): 기간(오늘 / 마지막 요약 뒤) 기준 요약 3~5줄 + 정해진 것 / 아직 안 정해진 것.
  - ③ 할 일 정리 (없음): 할 일 후보 [{ title, assigneeId(팀원 ID 또는 null), due(날짜 또는 null), sourceMessageIds }]. 이미 있는 할 일(`team_tasks`)과 겹치면 빼기. → 앱은 '추가'를 누르면 `createTeamTask`로 저장.
  - ④ 공유된 자료 (없음): 팀 자료(`team_materials`: 올린 파일 · 대화 속 링크는 A가 자동 저장)를 종류별로 묶고 한 줄 설명 + "올리기로 했는데 아직 없는 자료" 찾기.
  - ⑤ 회의록 정리 (없음): 출력은 `Minutes` 모양 { summary[], decided[{ text, settled }], tasks[] }. 입력은 **직접 붙여 넣은 회의 메모 + 회의 시간 동안의 대화방 메시지** (11/6 결정). 녹음은 이번 범위에서 빼요.
  - 실제로 돌리려면 `GEMINI_API_KEY`가 필요해요 (누가 발급 · 무료 한도 확인).
- **현규님 (D) — 11/6 `4a829da`를 가져와서 확인한 것**: 팀 추천 기준(1시간 → 차이 → 최장, `rankExclusionReason`), 지역 반경 검색(`searchArea` 주변만, `searchAreas` 1~3곳), 가까우면 걷는 시간(`getWalkingRoute`) 모두 반영됨. 실제 카카오로 '서울역' 스터디룸 → 근처 2곳 · 1위 서울역 삼경교육센터(27분 · 20분) 확인. 출발지 위치 인식(`resolveOrigin`)은 예전과 결과가 같아요 ('서울역' · '구로역' · '서울역 1호선'은 아직 못 정함, '구로역 1호선'은 됨).
- **현규님 (D)** (예전 메모)
  - 새 추천 기준(1시간 제한 → 차이 → 최장)을 D 코드에 반영할지. 지금 D의 `rankPlacesByFairness`는 예전 기준(최장 우선)이라 앱은 `place-ranking.ts`를 써요
  - `findPlaces`가 글자로만 검색해서 다른 동네 장소가 섞여요 → 좌표·반경 검색 (`area-search.ts` 참고)
  - 걸어갈 만큼 가까우면 대중교통 경로가 없어 '미확인'이 돼요 → 도보 시간으로 처리
  - (11/6 실제 테스트) `resolveOrigin`이 위치를 못 정하는 출발지가 많아요: 동네까지만 있는 주소('서울 구로구 구로동' ← '구로역광장'), 노선 없는 역 이름('구로역'), 노선이 있어도 결과가 여러 개인 역('서울역 1호선'). 앱은 출발지를 고를 때 `/api/places/check-origin`으로 미리 확인해 막고 있어요. D에서 카카오 장소 ID나 좌표로 받는 방법을 같이 정하면 좋아요.
- **지우님 (C)** — C SQL 확인 부탁: 확정할 때 `c_schedule_action('confirm')`이 `messages`에 확정 카드를 직접 넣어요 (security definer). 현서님은 확정 메시지를 `create_confirmed_message`(방장 확인)로만 만들자고 했어요 → 둘 중 어느 쪽으로 할지 현서님과 맞추기.
- **지우님 (C)** — 11/6 밤 전달함 · 답 기다리는 중: **한밤중 시간 후보**. AI가 '11/9 하루 종일 가능'을 00:00~24:00으로 이해하면 C가 가장 이른 00:00–01:00을 후보로 내서 그대로 확정될 수 있어요 (실제로 '합주' 11/9(월) 00:00 확정 · 23:10 출발 권장이 나옴). 만날 만한 시간(예: 09:00~22:00) 안에서만 후보를 찾게 부탁.
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
