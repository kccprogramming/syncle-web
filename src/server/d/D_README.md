# KCC 미니 캡스톤 D 담당 코드 전달 안내

AI 회의 조율 협업툴에서 C는 회의 요청을 만들고, D의 `findPlaces`는 장소 후보와 참석자별 이동시간을 계산합니다. 오프라인 요청은 검색 지역과 회의 목적을 합쳐 카카오에서 검색합니다. 시연 옵션을 켜면 최대 두 후보에 대해 출발지 주소를 좌표로 바꾸고, 대중교통 경로를 조회한 다음 공평성 순위를 계산합니다. 같은 요청의 동일 주소와 동일 출발·도착 좌표 쌍은 조회 결과를 재사용합니다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `searchKakaoPlaces.ts` | 카카오 키워드 검색으로 최대 세 장소의 이름, 주소, 좌표, 링크 조회 |
| `geocodeAddress.ts` | 도로명·지번 주소를 좌표로 변환. 0건과 복수 후보를 미확인 사유로 구분 |
| `resolveOrigin.ts` | 주소는 기존 주소 변환 함수에 전달하고, 역 이름은 카카오 지하철역 검색으로 좌표 확인 |
| `getTransitRoute.ts` | 가장 빠른 대중교통 경로를 골라 분으로 반올림하고 환승 횟수를 반환 |
| `rankPlacesByFairness.ts` | 최장 이동시간, 시간 차이, 순위와 한국어 추천 이유 계산 |
| `kakaoApiError.ts` | 카카오 요청과 오류 코드, 화면용 메시지를 공통 처리 |
| `recommendDepartureTime.ts` | 기존 참석자별 이동시간과 여유시간으로 출발 권장 시각 계산 |
| `findPlaces.ts` | 네 함수를 연결하고 입력, 온라인 생략, 개별 오류를 처리 |
| `D_CONTRACT.md` | C와 D의 데이터 계약 임시안 |
| `.env.example`, `.gitignore` | 환경변수 이름과 비밀 파일 제외 설정 |

## 준비와 실행

검증한 환경은 Windows PowerShell, Node.js v26.13.0입니다. Node.js 내장 TypeScript 실행과 `fetch`를 사용합니다. npm은 버전 확인용이며 패키지 설치는 필요 없습니다. 기존 개발 환경에서 확인한 npm 버전은 11.20.0입니다.

```powershell
cd .\D_HANDOFF
node -v
npm.cmd -v
```

Node.js가 설치되어 있는데 명령을 찾지 못하면 같은 PowerShell에서 다음 줄을 실행하세요.

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
```

실제 조회를 하려면 `Copy-Item .env.example .env.local`로 로컬 설정 파일을 만들고 편집기에서 `KAKAO_REST_API_KEY=`의 등호 뒤에 본인 카카오 REST API 키를 입력하세요. 이 키는 장소·주소·대중교통 API 인증에 쓰입니다. 서버에서만 읽고 브라우저 코드, 화면, Git, 전달 폴더에 넣지 마세요. C 프로젝트로 옮길 때도 그 프로젝트의 Git 제외 규칙을 확인하세요.

```powershell
# 예시 데이터만 사용. 키와 네트워크 없이 실행
node .\rankPlacesByFairness.ts

# 아래는 실제 카카오 API를 호출
node --env-file=.env.local .\searchKakaoPlaces.ts
node --env-file=.env.local .\geocodeAddress.ts
node --env-file=.env.local .\getTransitRoute.ts
node --env-file=.env.local .\findPlaces.ts
```

통합 테스트 명령의 마지막에 `success`, `empty`, `unknown`을 붙이면 해당 예시만 실행합니다. 옵션 없이 실행하면 세 예시를 모두 실행하고 온라인 생략도 확인합니다. 실제 검색과 경로 결과는 실행 시점에 달라질 수 있습니다. 예시가 기대한 결과와 달라지면 내장 검사가 실패할 수 있습니다.

## C 프로젝트에서 호출하기

여덟 TypeScript 파일을 C 프로젝트의 **서버 코드 폴더**에 함께 복사하세요. 상대 import를 쓰므로 여덟 파일을 같은 폴더에 두면 됩니다. C의 서버 실행 환경에서 `KAKAO_REST_API_KEY`를 주입하고 서버 함수에서 `findPlaces`를 불러오세요. 아래 import 경로는 호출 파일과 D 코드가 같은 폴더일 때의 예시입니다.

```ts
import { findPlaces } from './findPlaces.ts';

type FindPlacesInput = Parameters<typeof findPlaces>[0];
const input: FindPlacesInput = {
  teamId: 'team-01',
  proposalId: 'proposal-01',
  timeOptionId: 'option-01',
  meetingMode: 'offline',
  meetingPurpose: '스터디룸',
  startAt: '2026-11-05T14:00:00+09:00',
  endAt: '2026-11-05T15:00:00+09:00',
  searchArea: '국민대학교',
  expectedAttendeeCount: 2,
  dataMode: 'api',
  members: [
    { memberId: 'member-01', origin: '서울 성북구 정릉로 77' },
    { memberId: 'member-02', origin: '서울 성북구 보국문로 75' },
  ],
};

const result = await findPlaces(input);
const demo = await findPlaces(input, { previewUnverified: true });
```

실제 연결에서는 필요한 호출 하나를 선택하세요. C가 검색 지역과 세 ID를 전달하고, 제안과 시간 후보가 해당 팀에 속하는지 확인합니다. 시각은 초를 포함한 서울 기준 ISO 8601 문자열이고 종료 시각은 시작보다 늦어야 합니다. 오프라인 예상 인원은 양의 정수이며, `members`에 들어가는 조회 대상 수와 별개입니다. 출발지를 모르는 사람은 `memberId`를 보내고 `origin`을 생략하세요.

### 출발역 이름 입력

`members[].origin`은 그대로 문자열입니다. 주소 대신 `길음역` 또는 `건대입구역 2호선`처럼 보낼 수 있습니다. `역`으로 끝나는 이름과 뒤에 호선이 붙은 이름은 카카오 지하철역 카테고리(`SW8`)에서 검색합니다. 호선 없는 이름으로 여러 후보가 나오거나 정확히 일치하는 역을 식별할 수 없으면, 화면에서 호선이나 주소를 다시 입력받으세요. 출구 번호나 지역명을 덧붙인 문자열을 따로 해석하는 기능은 없습니다.

`resolveOrigin`을 직접 호출하면 검색 0건(`not_found`)과 확인 필요(`confirmation_required`)를 구분할 수 있습니다. 기존 `findPlaces` 응답에서는 둘 다 해당 참석자의 `unknown`으로 표시합니다. 검색 요청 자체가 실패하면 `error`입니다. 모두 이동시간은 `null`입니다. 계약 초안에 현재 지원 형식을 기록했습니다.

### 같은 시간에 다른 장소 보기

기존 요청의 세 ID와 `startAt`, `endAt`을 그대로 넘기고, 이전에 보여준 장소 ID를 추가하세요. `excludedPlaceIds`는 C와 합의 전인 선택 입력입니다.

```ts
const next = await findPlaces(
  { ...input, excludedPlaceIds: ['previous-place-01', 'previous-place-02'] },
  { previewUnverified: true },
);
```

제외 목록이 있으면 같은 검색어의 추가 페이지도 확인하며, 새 후보는 최대 두 곳입니다. 새 후보의 이동시간과 순위는 이 요청에서 계산합니다. 결과가 없으면 `status: "ok"`와 `places: []`, 검색 요청이 실패하면 `status: "error"`와 원인별 `error.code`가 반환됩니다. 미리보기 옵션을 생략하면 기존 장소 검증 정책을 적용합니다. C 서버에서 기존 시간 후보와 누적 제외 목록을 불러와 이 함수를 호출하고, 화면 응답과 제안 저장을 연결하세요.

### 출발 권장 시각 계산 (C 연동 임시안)

프로젝트 폴더에서 `node .\recommendDepartureTime.ts`를 실행하면 모의 테스트와 예시 결과를 볼 수 있습니다. API 키와 네트워크는 필요 없습니다. C 프로젝트에는 이 파일도 복사한 뒤 기존 `findPlaces` 결과의 선택한 장소에서 계산합니다.

```ts
import { recommendDepartureTime } from './recommendDepartureTime.ts';

const departures = selectedPlace.travelTimes.map((travel) =>
  recommendDepartureTime({
    ...travel,
    startAt: selectedTimeOption.startAt,
    arrivalBufferMinutes: 10, // 시연용 임시 예시
    travelTimeBasis: result.preview?.travelTimeBasis,
  }),
);
```

위 코드의 `result`는 장소가 포함된 미리보기 응답입니다. TypeScript에서 전체 반환 타입을 다룰 때는 먼저 `result.status === 'ok' && 'preview' in result`로 미리보기인지 확인하세요. 이미 확보한 이동시간을 넘겨도 같은 방식으로 계산합니다.

모의 입력 JSON

```json
{
  "memberId": "member-01",
  "startAt": "2026-11-05T14:00:00+09:00",
  "minutes": 25,
  "status": "ok",
  "checkedAt": "2026-11-05T12:00:00+09:00",
  "arrivalBufferMinutes": 10,
  "travelTimeBasis": "api_estimate_without_meeting_time"
}
```

출력 JSON

```json
{
  "memberId": "member-01",
  "minutes": 25,
  "checkedAt": "2026-11-05T12:00:00+09:00",
  "travelTimeBasis": "api_estimate_without_meeting_time",
  "status": "ok",
  "recommendedDepartureAt": "2026-11-05T13:25:00.000+09:00"
}
```

회의 시작에서 이동시간과 도착 여유시간을 뺍니다. `checkedAt`은 기존 이동시간을 조회한 시각입니다. 이 계산은 기존 예상 이동시간을 빼서 얻은 안내값이며, 회의 시간대의 실제 교통 상황을 반영한 확정 시각으로 표시하지 마세요. 조회 기준을 전달하지 않으면 `travelTimeBasis`는 `null`입니다.

이동시간 미확인이나 유효하지 않은 시작 시각·여유시간은 `status: "unknown"`입니다. 조회 실패는 `status: "error"`, `reason: "travel_time_lookup_failed"`이며 전달받은 오류 상세가 있으면 유지합니다. 두 경우 모두 `recommendedDepartureAt: null`입니다. 이동시간을 확인할 수 없으면 `minutes`도 `null`입니다. 도착 여유시간 정책, 안내 문구, 별도 함수의 출력 필드와 화면 연결 방식은 C와 합의할 항목입니다.

## 입력과 출력 예시

아래 JSON은 **형식을 설명하는 가상 예시**입니다. API 모드의 응답을 예시로 썼으므로 `dataSource`는 `api`입니다. 각 상황에서 예시 코드를 실제 실행하면 카카오의 현재 응답을 받습니다.

### 1. 정상 오프라인 요청

```json
{
  "teamId": "team-01",
  "proposalId": "proposal-01",
  "timeOptionId": "option-01",
  "meetingMode": "offline",
  "meetingPurpose": "스터디룸",
  "startAt": "2026-11-05T14:00:00+09:00",
  "endAt": "2026-11-05T15:00:00+09:00",
  "searchArea": "국민대학교",
  "expectedAttendeeCount": 2,
  "dataMode": "api",
  "members": [
    {"memberId": "member-01", "origin": "서울 성북구 정릉로 77"},
    {"memberId": "member-02", "origin": "서울 성북구 보국문로 75"}
  ]
}
```

`findPlaces(input)`에서 검색이 성공하면 현재는 검증된 장소가 없어 다음과 같이 반환합니다.

```json
{
  "teamId": "team-01",
  "proposalId": "proposal-01",
  "timeOptionId": "option-01",
  "status": "ok",
  "dataSource": "api",
  "places": []
}
```

### 2. 미검증 후보 시연

같은 입력에 두 번째 인수로 `{ previewUnverified: true }`를 전달합니다.

```json
{
  "teamId": "team-01",
  "proposalId": "proposal-01",
  "timeOptionId": "option-01",
  "status": "ok",
  "dataSource": "api",
  "places": [{
    "placeId": "demo-place",
    "name": "시연용 가상 스터디룸",
    "coordinates": {"latitude": 37.61, "longitude": 127.01},
    "checkedAt": "2026-11-04T12:00:00.000+09:00",
    "travelTimes": [
      {"memberId": "member-01", "status": "ok", "minutes": 12, "transferCount": 0, "calculationMethod": "transit_route", "checkedAt": "2026-11-04T12:00:01.000+09:00"},
      {"memberId": "member-02", "status": "ok", "minutes": 8, "transferCount": 0, "calculationMethod": "transit_route", "checkedAt": "2026-11-04T12:00:02.000+09:00"}
    ],
    "maxTravelMinutes": 12,
    "travelTimeDifference": 4,
    "rank": 1,
    "recommendationReason": "최장 이동시간 12분을 우선 비교한 결과 1위입니다. 이동시간 차이는 4분이고 확인된 선호 조건은 0개입니다."
  }],
  "preview": {
    "venueConditions": "unverified",
    "travelTimeBasis": "api_estimate_without_meeting_time"
  }
}
```

주소와 상세 링크가 있으면 `address`, `detailUrl`도 반환합니다. 미리보기는 임시 시연 옵션입니다. **시설, 수용 인원, 예약 가능 여부는 미검증**으로 표시하세요. 순위 문구의 선호 조건 0개는 확인된 충족 건수가 0개라는 의미입니다. 이동시간은 조회 시점의 예상값이며 회의 시작 시각을 반영하지 않습니다.

### 3. 온라인 회의

```json
{
  "teamId": "team-01",
  "proposalId": "proposal-01",
  "timeOptionId": "option-01",
  "meetingMode": "online",
  "meetingPurpose": "진행 상황 공유",
  "startAt": "2026-11-05T14:00:00+09:00",
  "endAt": "2026-11-05T15:00:00+09:00",
  "dataMode": "api"
}
```

```json
{
  "teamId": "team-01",
  "proposalId": "proposal-01",
  "timeOptionId": "option-01",
  "status": "skipped",
  "dataSource": null,
  "places": []
}
```

### 4. 참석자 출발지 누락

예시 2의 호출에서 두 번째 구성원을 `{"memberId":"member-02"}`로 바꿉니다. 응답은 예시 2와 같은 구조이며 두 번째 이동 항목과 해당 장소의 계산 필드는 다음 값으로 바뀝니다.

```json
{
  "memberId": "member-02",
  "status": "unknown",
  "minutes": null,
  "transferCount": null,
  "calculationMethod": null,
  "checkedAt": null
}
```

`maxTravelMinutes`, `travelTimeDifference`, `rank`는 모두 `null`이고 추천 이유는 “일부 구성원의 유효한 이동시간이 없어 공평성 순위를 계산할 수 없습니다.”입니다.

### 5. 장소 검색 결과 없음

예시 2의 요청에서 검색 결과가 없는 목적과 지역을 전달하면 예시 1과 같은 `status: "ok"`, `dataSource: "api"`, `places: []`가 반환됩니다. 빈 응답에는 `preview`가 없습니다. 현재 기본 호출에서는 실제 검색 0건과 검증된 장소 0건의 응답이 같습니다.

### 6. 대중교통 API 실패

예시 2의 입력에서 두 번째 참석자의 대중교통 요청만 HTTP 503을 반환한다고 가정합니다. 전체 응답의 `status`는 `ok`이고, 후보와 첫 번째 참석자의 이동시간이 유지됩니다. 두 번째 이동 항목은 다음과 같습니다.

```json
{
  "memberId": "member-02",
  "status": "error",
  "minutes": null,
  "transferCount": null,
  "calculationMethod": null,
  "checkedAt": null
}
```

해당 장소의 두 공평성 지표와 순위, 추천 이유는 예시 4와 동일합니다. `null`은 미확인 또는 조회 실패로 표시하고 0분으로 바꾸지 마세요. 장소 검색 자체가 HTTP 503으로 실패하면 응답 전체가 다음처럼 바뀝니다.

```json
{
  "status": "error",
  "dataSource": null,
  "places": [],
  "error": {"code": "KAKAO_TEMPORARY_FAILURE", "message": "카카오 서비스에 일시적인 장애가 발생했습니다.", "stage": "place_search", "httpStatus": 503}
}
```

잘못된 입력은 `INVALID_INPUT`, 오프라인 `dataMode: "mock"` 요청은 `UNSUPPORTED_DATA_MODE`입니다. 둘 다 위와 같은 오류 구조를 사용합니다.

### C 화면의 카카오 오류 표시

장소 검색 오류는 `result.error.message`를, 후보 하나의 출발지·이동시간 오류는 해당 `travelTimes[].error?.message`를 표시하세요. 전체 상태가 `ok`여도 참석자별 실패가 있을 수 있습니다. 개별 HTTP 503은 `KAKAO_TEMPORARY_FAILURE`와 `stage: "transit_route"`로 표시되며 이동시간은 `null`입니다.

- 인증 실패 (`KAKAO_AUTH_ERROR`) — 카카오 API 인증에 실패했습니다.
- 권한 부족 (`KAKAO_PERMISSION_DENIED`) — 카카오 API 사용 권한을 확인해 주세요.
- 사용 한도 (`KAKAO_QUOTA_EXCEEDED`) — 카카오 API 사용 한도를 초과했습니다.
- 일시 장애 (`KAKAO_TEMPORARY_FAILURE`) — 카카오 서비스에 일시적인 장애가 발생했습니다.
- 연결 또는 시간 초과 (`KAKAO_NETWORK_ERROR`) — 카카오 서버에 연결하지 못했거나 응답 시간이 초과되었습니다.

기존에 `PLACE_SEARCH_FAILED`만 비교했다면 전체 실패는 먼저 `status === "error"`로 확인하고, 세부 표시는 `error.code`로 나누세요. 입력과 성공 응답 구조는 유지됩니다. 전체 코드 목록은 계약 문서에 있습니다.

## 순위 표시와 계약 차이

- 팀 기획 기준에 따라 최장 이동시간이 짧은 곳부터 순위를 매깁니다. 동점이면 이동시간 차이가 작은 곳, 확인된 선호 조건을 더 많이 충족한 곳, 장소 ID 오름차순으로 비교합니다. 예를 들어 A의 이동시간이 12·20분, B가 18·22분이면 기존에는 차이가 4분인 B가 1위였고, 현재는 최장 시간이 20분인 A가 1위입니다. 통합 코드에서 선호 조건 충족 건수는 0으로 전달됩니다. 응답 배열 자체는 순위순으로 재정렬되지 않으므로 화면 정렬에는 `rank`를 사용하세요.
- 순위는 `members`에 포함된 조회 대상이 2명 이상이고 모두의 이동시간을 확인했을 때만 계산합니다. **전체 참석자 기준**이라고 표시하려면 출발지를 모르는 사람도 `memberId`를 포함하세요.
- 현재 경로 조회에는 `startAt`을 전달하지 않습니다. 회의 시간대 교통을 반영한 값으로 표시하지 마세요. 시연 응답의 `preview`와 오프라인 mock 미지원 오류는 현행 코드의 동작이며 계약 확정 항목이 아닙니다.
- DB 저장, 프런트엔드, HTTP 서버 및 `ok/data/error` 포장, 시설·수용 인원·예약 검증은 구현 범위에 남아 있습니다. 현재 함수는 내부 결과 객체를 반환합니다.

## 과거 실제 실행 기록과 남은 합의

이전 실제 카카오 테스트에서는 장소 검색 3건, 정릉로 77 좌표 변환 성공, 독립 대중교통 예시 25분·환승 2회를 확인했습니다. 이전 순위 기준으로 진행한 통합 시연에서는 어라운드스터디카페 정릉점이 12분·8분으로 1위, 카공족 정릉시장점이 14분·4분으로 2위였습니다. 위 가상 JSON과 별개의 과거 조회 기록입니다.

C와 미리보기 허용 범위와 화면 문구, 시설·인원·예약 검증 담당, 회의 시각 미반영 이동시간 표기, 전체 참석자 명단 전달 기준을 합의해야 합니다. 빈 결과의 원인을 나눌지, mock과 HTTP 응답 형식 및 DB 저장을 어느 계층에서 맡을지도 미확정입니다.
