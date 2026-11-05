# KCC AI Meeting C·D 통합 안내

이 문서는 현재 D 코드에 근거한 연동 초안입니다. 작업 공간과 인접한 KCC/Meeting 폴더 및 로컬 전달 압축 목록에서 C의 통합 소스를 확인하지 못했습니다. 아래 역할 구분은 권장안이며 C가 이미 구현한 코드와의 실제 중복 여부는 확인이 필요합니다.

## 1. 권장 역할 구분

| 담당 | 하는 일 |
| --- | --- |
| C | 전체 참석자와 선택한 시간 후보를 준비합니다. 비교 지역 2~3곳을 선택하고 서버에서 D 함수를 한 번 호출합니다. 결과 저장, 서버 응답 변환, 화면 연결과 키 없는 별도 시연 데이터를 맡습니다. |
| D | 지정된 지역에서 실제 장소를 검색하고 좌표와 반경을 확인합니다. 중복 장소를 합치고 참석자별 대중교통 또는 도보 이동시간을 조회합니다. 합친 후보의 순위와 미확인·오류 정보를 반환합니다. |

권장 흐름은 **C 지역·시간·명단 준비 → D 검색·이동시간·통합 순위 → C 저장·표시**입니다. C에서 기존 검색·중복 제거·공평성 재계산을 하는 코드가 있다면 실제 API 경로에서 D 결과를 사용하는 쪽으로 통합하세요. 단일 지역 목록을 화면에 순위순으로 표시할 때도 기존 `rank` 값으로 정렬합니다. 지역 자동 선정은 D 범위에 없습니다.

## 2. 실제 호출

C 서버에서 같은 폴더에 있는 전달용 TypeScript 파일을 사용합니다. 서버 환경변수 이름은 `KAKAO_REST_API_KEY`입니다. 키를 프런트엔드로 보내지 마세요.

```ts
import { findPlaces } from './findPlaces.ts';

const result = await findPlaces({
  teamId: 'team-01',
  proposalId: 'proposal-01',
  timeOptionId: 'option-01',
  meetingMode: 'offline',
  meetingPurpose: '합주실',
  startAt: '2026-11-06T14:00:00+09:00',
  endAt: '2026-11-06T15:00:00+09:00',
  expectedAttendeeCount: 2,
  members: [
    { memberId: 'member-01', origin: '길음역' },
    { memberId: 'member-02', origin: '서울 성북구 정릉로 77' },
  ],
  searchAreas: ['서울역', '시청역', '종로3가역'],
  searchRadiusMeters: 1500,
  excludedPlaceIds: [],
  dataMode: 'api',
}, { previewUnverified: true, maxTravelMinutesLimit: 60 });
```

| 필드 | 실제 자료형과 사용 방법 |
| --- | --- |
| `teamId`, `proposalId`, `timeOptionId` | 필수인 비어 있지 않은 문자열. C가 연결 관계를 확인합니다. 성공·생략에서 그대로 돌려주며 전체 오류에서는 생략합니다. |
| `meetingMode`, `meetingPurpose` | 필수. 모드는 `offline` 또는 `online`, 목적은 비어 있지 않은 문자열입니다. 목적이 장소 검색어가 됩니다. |
| `startAt`, `endAt` | 필수인 서울 기준 ISO 8601 문자열. 초와 `+09:00`을 포함하고 종료가 시작보다 늦어야 합니다. 출발 권장 시각에는 선택된 `startAt`을 쓰며, 경로 조회 시각으로 전달되지는 않습니다. |
| `expectedAttendeeCount` | 오프라인 필수인 양의 정수. 순위에 참여하는 사람은 이 숫자가 아니라 실제 `members`로 정합니다. |
| `members` | 코드상 선택인 배열. 전체 참석자 순위를 원하면 C가 전원을 전달합니다. `memberId`는 중복 없는 문자열이며, 선택 `origin`은 비어 있지 않은 주소나 역 이름입니다. 출발지를 모르면 해당 사람의 ID만 전달합니다. |
| `searchAreas`, `searchArea` | `searchAreas`는 1~3개의 비어 있지 않은 문자열 배열이며 임시 계약입니다. 전달하면 기존 단일 `searchArea`보다 우선합니다. 배열을 생략한 오프라인 요청에는 단일 지역이 필수입니다. |
| `searchRadiusMeters` | 선택 정수 1~20,000. 기본 1,500m이며 지정한 지역마다 동일하게 적용합니다. |
| `excludedPlaceIds` | 선택 문자열 배열. 재검색할 때 같은 시간 후보에서 이미 표시한 카카오 장소 ID를 누적해 보내면 모든 지역에 적용됩니다. |
| `dataMode` | 필수. 실제 오프라인 조회는 `api`입니다. 오프라인 `mock`은 `UNSUPPORTED_DATA_MODE`입니다. 유효한 온라인 요청은 검색을 생략합니다. |

두 번째 인수의 `previewUnverified`는 선택 불리언입니다. 현재 후보를 보여주는 시연에는 `true`가 필요합니다. 생략하면 검색이 성공해도 일반 호출은 미검증 장소를 반환하지 않습니다. `maxTravelMinutesLimit`은 선택인 0 이상의 안전한 정수이고 기본값은 시연용 60분입니다. 두 옵션은 입력 JSON과 별개입니다.

## 3. 반환값과 화면 처리

다음은 실제 반환 구조를 따르는 **가상 예시**입니다. 카카오를 호출해 얻은 기록이나 D의 mock 모드 결과가 아닙니다.

```json
{
  "teamId": "team-01",
  "proposalId": "proposal-01",
  "timeOptionId": "option-01",
  "status": "ok",
  "dataSource": "api",
  "areaResults": [
    {"searchArea":"서울역","status":"ok","candidateCount":1},
    {"searchArea":"시청역","status":"empty","candidateCount":0},
    {"searchArea":"종로3가역","status":"error","error":{"code":"KAKAO_TEMPORARY_FAILURE","message":"카카오 서비스에 일시적인 장애가 발생했습니다.","stage":"place_search","httpStatus":503}}
  ],
  "places": [
    {
      "placeId":"example-01",
      "name":"예시 합주실",
      "coordinates":{"latitude":37.55,"longitude":126.97},
      "checkedAt":"2026-11-06T12:00:00.000+09:00",
      "matchedSearchAreas":["서울역"],
      "travelTimes":[
        {"memberId":"member-01","status":"ok","minutes":30,"transferCount":1,"calculationMethod":"transit_route","checkedAt":"2026-11-06T12:00:01.000+09:00"},
        {"memberId":"member-02","status":"ok","minutes":5,"transferCount":0,"calculationMethod":"walking_route","routeDistanceMeters":380,"checkedAt":"2026-11-06T12:00:02.000+09:00"}
      ],
      "maxTravelMinutes":30,
      "travelTimeDifference":25,
      "rank":1,
      "recommendationReason":"전원이 60분 이내이며, 이동시간 차이 25분을 우선 비교한 결과 1위입니다. 최장 이동시간은 30분이고 확인된 선호 조건은 0개입니다."
    }
  ],
  "preview":{"venueConditions":"unverified","travelTimeBasis":"api_estimate_without_meeting_time"}
}
```

- 최상위 `status`는 `ok`, `error`, `skipped`입니다. `places`는 배열입니다. 전체 실패의 `error`는 `code`와 `message`를 포함하며 카카오 오류이면 `stage`, 가능한 경우 `httpStatus`가 붙습니다. 온라인 `skipped`에서는 빈 배열을 반환합니다.
- 다지역의 `areaResults`는 지역별 `ok`, `empty`, `error`를 보여 줍니다. `candidateCount`는 통합·중복 제거 전 후보 수입니다. `matchedSearchAreas`는 해당 장소를 찾은 지역들입니다. 검증을 통과했다는 의미는 아닙니다.
- 다지역 결과는 `rank` 오름차순이며 `rank: null`은 뒤에 남습니다. 단일 `searchArea` 호출은 검색 순서로 배열을 유지하며 다지역용 필드를 생략합니다.
- `travelTimes`는 참석자별 배열입니다. `calculationMethod: "transit_route"`는 대중교통, `"walking_route"`는 도보입니다. 도보의 `routeDistanceMeters`는 선택이며 대중교통 환승 횟수는 `transferCount`를 사용합니다. `unknown`은 미확인, `error`는 조회 실패로 표시하고 `minutes: null`을 0분으로 바꾸지 마세요.

## 4. 순위와 예외 처리

최소 두 명의 이동시간이 전부 확인되어야 순위를 계산합니다. 60분 기본 상한을 초과하면 순위에서 제외하며 정확히 60분은 허용합니다. 통과한 후보는 시간 차이가 작은 순, 최장 이동시간이 짧은 순, 확인된 선호 조건이 많은 순, 장소 ID 순입니다. 현재 통합에서 확인된 선호 조건 수는 0입니다. D의 `rank`, 지표, `rankExclusionReason`을 그대로 사용합니다. 이는 이번에 조회한 후보끼리의 비교입니다.

| 상황 | C 처리 |
| --- | --- |
| 일부 지역 실패 | 정상 후보를 보여 주고 실패 지역과 `areaResults[].error`를 별도로 안내합니다. 성공 지역이 모두 비어 있으면 전체 `ok`라도 후보는 없습니다. |
| 모든 지역 실패 | 전체 `error.code: "ALL_SEARCH_AREAS_FAILED"`. 개별 원인은 `areaResults`에서 확인합니다. |
| 모든 지역이 정상 검색했으나 0곳 | 전체 `ok`, `places: []`, 모든 지역이 `empty`입니다. |
| 이동시간 미확인 또는 조회 실패 | `rank: null`, `rankExclusionReason: "travel_time_unavailable"`. 해당 참석자의 상태와 오류를 유지합니다. |
| 확인된 최장 시간이 상한 초과 | `rank: null`, `rankExclusionReason: "max_travel_time_exceeded"`. 이동시간과 지표는 표시할 수 있습니다. |
| 참석자가 2명 미만 | 유효한 이동시간만 있는 경우 `insufficient_members`입니다. |
| 미검증 후보 | `preview.venueConditions: "unverified"`이면 시설·수용 인원·예약 가능 여부를 미검증으로 표시합니다. |
| 키 누락 | 오프라인 단일 지역은 `KAKAO_CONFIGURATION_ERROR`입니다. 다지역에서는 전체 실패 코드 아래에 각 지역의 설정 오류가 들어갑니다. 키 없는 시연은 C의 별도 데이터 경로에서 출처를 표시합니다. |
| 기존 장소 제외 재검색 | 동일한 세 ID·시각·명단을 보내고 `excludedPlaceIds`를 누적합니다. 이번 결과 후보의 순위만 표시합니다. |

출발 안내가 필요하면 선택 장소의 `travelTimes`를 순회하며 `recommendDepartureTime({ ...travel, startAt, arrivalBufferMinutes, travelTimeBasis })`를 호출합니다. `travelTimeBasis`는 미리보기에서 가져올 수 있습니다. 조회 시점의 예상 이동시간을 이용한 권장 시각입니다. 회의 시간대의 교통 예측으로 표시하지 마세요.

## 5. C에서 연결하거나 확인할 부분

- **연결:** 지역 선택과 참석자 명단 작성, 시간 후보와 결과 저장, 화면 상태 매핑을 C에서 연결합니다. 공통 HTTP `ok/data/error` 포장이 필요하면 서버에서 변환합니다. D 함수는 내부 결과 객체를 반환합니다.
- **C에게 요청할 자료:** 실제 서버 호출 파일과 지역 검색·공평성 계산 파일의 위치, 시간 후보·참석자 타입과 예시, 화면 정렬 및 오류 상태 매핑, 저장 구조, 키 없는 시연 데이터의 분기와 표시 방식입니다. 이 자료를 기준으로 중복 호출과 중복 순위 계산 위치를 확인할 수 있습니다.
- **팀 합의:** 검색 지역 목록과 1,500m 반경 정책, 60분 상한과 순위 없는 후보 표시, 미검증 시연 허용 범위, 출발 여유시간, 부분 실패 시 저장·재조회 정책을 확정해야 합니다. 저장 책임과 저장 시점, 공통 HTTP 상태 매핑도 팀 기준에 맞춰 확인해야 합니다.
