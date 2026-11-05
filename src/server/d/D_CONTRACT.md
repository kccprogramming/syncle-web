# C–D 장소 검색 데이터 계약

이 문서는 현재 D 코드의 입출력을 기록한 **계약 초안**이다. C와 최종 합의 전까지 연동 정책과 문구는 임시안이다.

## 1. findPlaces의 역할

`findPlaces`는 C가 전달한 회의 목적, 시간대, 검색 지역과 장소 조건을 바탕으로 장소 후보를 찾는다. 예를 들어 팀 발표 준비라면 대화와 화면 공유가 가능한 공간을 우선 고려한다. 출발지가 주어진 구성원에 대해서는 장소별 예상 이동시간을 반환한다. C는 이 결과를 이용해 후보를 비교한다. 예약 가능 여부는 별도로 확인해야 한다.

## 2. 공통 규칙

- `teamId`, `proposalId`, `timeOptionId`, `memberId`, `placeId`는 모두 JSON 문자열이다. 숫자로 변환하면 앞자리 0이 사라질 수 있으므로 원래 값을 유지한다.
- 시각은 Asia/Seoul 기준 ISO 8601 문자열로 전달한다. 예시는 `2026-11-05T14:00:00+09:00`이다. 이동시간은 시각과 구분해 정수 분으로 표현한다.
- 필수 키는 항상 보내고, 선택 키는 값이 없으면 생략한다. 아래에서 명시한 미확인 값에는 JSON의 `null`을 사용한다.

## 3. 입력 JSON (임시안)

| 필드 | 필수 여부 | 타입과 의미 |
| --- | --- | --- |
| `teamId` | 필수 | 문자열. 팀 ID |
| `meetingPurpose` | 필수 | 문자열. 장소 검색에 사용할 회의 목적 |
| `proposalId` | 필수 | 문자열. 팀에 속한 회의 제안 ID |
| `timeOptionId` | 필수 | 문자열. 제안에 속한 시간 후보 ID |
| `startAt`, `endAt` | 필수 | 초를 포함한 ISO 8601 문자열(`+09:00`, 선택 소수 초 1~3자리). 종료는 시작보다 늦어야 한다. |
| `meetingMode` | 필수 | 문자열. `offline` 또는 `online` |
| `expectedAttendeeCount` | 오프라인 필수 | 1 이상의 정수. 장소 수용 인원 확인에 사용하며 이동시간 조회 대상 수와 별개다. |
| `requiredConditions` | 선택 | 비어 있지 않은 문자열의 배열. 반드시 충족해야 하는 장소 조건 |
| `preferredConditions` | 선택 | 비어 있지 않은 문자열의 배열. 후보 비교에 사용하는 선호 조건 |
| `searchArea` | 오프라인 필수 | 문자열. 장소를 찾을 지역 |
| `excludedPlaceIds` | 선택, 임시 확장 | 비어 있지 않은 장소 ID 문자열의 배열. 같은 회의 시간 후보에서 이미 제안한 장소를 제외할 때 사용 |
| `dataMode` | 필수 | 문자열. 오프라인은 `api` 지원. `mock`은 입력값으로 인식하지만 오프라인에서는 `UNSUPPORTED_DATA_MODE` 반환 |
| `members` | 선택 | 배열. 이동시간을 확인할 구성원 목록 |
| `members[].memberId` | 구성원마다 필수 | 문자열. 팀 내에서 중복되지 않는 구성원 ID |
| `members[].origin` | 선택 | 비어 있지 않은 문자열. 출발지 주소 또는 지하철역 이름(예: `길음역`, `건대입구역 2호선`) |

```json
{
  "teamId": "team-01",
  "meetingPurpose": "팀 발표 준비와 화면 공유",
  "proposalId": "proposal-01",
  "timeOptionId": "option-01",
  "startAt": "2026-11-05T14:00:00+09:00",
  "endAt": "2026-11-05T15:00:00+09:00",
  "meetingMode": "offline",
  "expectedAttendeeCount": 4,
  "requiredConditions": ["화면 공유 장비"],
  "preferredConditions": ["조용한 공간"],
  "searchArea": "서울 성북구 국민대학교 인근",
  "dataMode": "api",
  "members": [
    { "memberId": "member-01", "origin": "길음역" },
    { "memberId": "member-02" }
  ]
}
```

C는 같은 팀의 제안과 그 제안에 속한 시간 후보의 ID 및 시각을 함께 전달한다. D는 ID 문자열 형식을 검사하고, C는 전달 전 소속 관계와 시각이 일치하는지 확인한다. 현재는 시설·수용 인원·예약 여부를 검증할 수 없어 일반 호출에서는 장소를 반환하지 않는다. 미리보기에서는 확인된 선호 조건 수를 0으로 계산한다. 온라인은 공통 필수 입력을 검증한 뒤 장소 검색을 건너뛴다. 유효한 온라인 요청에서는 `api`와 `mock` 모두 `skipped`를 반환한다.

역 이름은 카카오 지하철역 카테고리(`SW8`)로 검색한다. 이름이 정확하고 후보를 하나로 식별할 수 있을 때만 좌표를 사용한다. 검색 0건이나 호선 구분이 필요하면 해당 이동 항목은 `unknown`이다. 주소나 호선까지 포함한 역 이름으로 다시 입력할 수 있다.

## 4. findPlaces 내부 반환 JSON (임시안)

`findPlaces(input)`는 일반 호출이다. `findPlaces(input, { previewUnverified: true })`는 두 번째 인수로 미검증 후보의 시연 표시를 허용한다. 이 옵션은 입력 JSON 안의 필드가 아니다. 현재 일반 오프라인 호출에서 검색이 성공하면 `places: []`를 반환한다. 미리보기에서도 검색 결과가 0건이면 같은 빈 응답이며 `preview`는 생략된다.

장소 재검색 시 C는 기존 `teamId`, `proposalId`, `timeOptionId`, `startAt`, `endAt`를 유지하고 제외 목록을 전달한다. 기존 조건의 검색 결과에서 ID를 제외하고, 최대 두 후보가 모이거나 카카오가 제공하는 페이지가 끝날 때까지 추가 검색한다. 새 후보가 없으면 `ok`와 빈 배열을 반환하고, 추가 페이지를 포함한 검색 요청 실패는 `status: "error"`와 원인별 코드로 구분한다. 시간 후보와 기존 장소 목록의 보관은 C가 담당한다.

| 필드 | 필수 여부 | 타입과 의미 |
| --- | --- | --- |
| `status` | 필수 | 문자열. 검색 성공은 `ok`, 온라인 검색 생략은 `skipped`, 검색 요청 실패는 `error` |
| `dataSource` | 필수 | 검색 성공 시 `api`, 오류 또는 검색 생략 시 `null` |
| `teamId`, `proposalId`, `timeOptionId` | 성공·생략 시 필수 | 입력과 동일한 문자열. 오류 시 생략 |
| `places` | 필수 | 배열. 검색 결과가 없거나 요청이 실패하면 빈 배열 |
| `places[].placeId`, `places[].name` | 장소마다 필수 | 문자열. 장소 ID와 이름 |
| `places[].address` | 선택 | 문자열. 확인된 장소 주소 |
| `places[].coordinates` | 선택 | 객체. `latitude`와 `longitude`는 각각 위도·경도 숫자(도 단위) |
| `places[].detailUrl` | 선택 | 문자열. 장소 상세 페이지의 절대 URL |
| `places[].checkedAt` | 장소마다 필수 | 문자열. 장소 정보를 확인한 서울 기준 시각. 미확인 시 `null` |
| `places[].maxTravelMinutes` | 장소마다 필수 | 가장 오래 걸리는 구성원의 이동시간(정수 분), 계산 불가 시 `null` |
| `places[].travelTimeDifference` | 장소마다 필수 | 가장 긴 이동시간에서 가장 짧은 이동시간을 뺀 값(정수 분), 계산 불가 시 `null` |
| `places[].rank` | 장소마다 필수 | 공평성 순위(1부터 시작하는 정수), 계산 불가 시 `null` |
| `places[].recommendationReason` | 장소마다 필수 | 문자열. 추천 근거 또는 순위를 매길 수 없는 이유 |
| `places[].travelTimes` | 장소마다 필수 | 배열. 요청의 구성원마다 항목 하나를 반환하며, 구성원이 없으면 빈 배열 |
| `places[].travelTimes[].memberId` | 이동 항목마다 필수 | 문자열. 입력에 있는 구성원 ID |
| `places[].travelTimes[].status` | 이동 항목마다 필수 | 문자열. `ok`는 계산 성공, `unknown`은 출발지나 경로 미확인, `error`는 조회 실패 |
| `places[].travelTimes[].minutes` | 이동 항목마다 필수 | 성공 시 0 이상의 정수, 그 외에는 `null` |
| `places[].travelTimes[].transferCount` | 이동 항목마다 필수 | 0 이상의 정수. 환승이 적용되지 않거나 미확인·실패 시 `null` |
| `places[].travelTimes[].calculationMethod` | 이동 항목마다 필수 | 성공 시 `transit_route`, 미확인·실패 시 `null` |
| `places[].travelTimes[].checkedAt` | 이동 항목마다 필수 | 문자열. 조회 결과를 확인한 서울 기준 시각. 확인하지 못한 경우 `null` |
| `preview` | 미검증 후보가 반환될 때만 | `venueConditions: "unverified"`, `travelTimeBasis: "api_estimate_without_meeting_time"` |
| `places[].travelTimes[].error` | 선택 | 개별 출발지·경로 오류 정보. 없으면 생략 |
| `error` | `status`가 `error`일 때 필수 | 객체. 문자열 필드 `code`와 `message` 포함. 성공 또는 생략 시 이 키는 생략 |

미리보기 응답 JSON 예시. 아래 값은 테스트용 가상 응답이며, `dataSource: "api"`는 실제 서비스 호출 시 반환되는 필드값을 예시한 것이다. 실제 조회 기록은 전달 README에서 별도로 확인할 수 있다.

```json
{
  "status": "ok",
  "dataSource": "api",
  "teamId": "team-01",
  "proposalId": "proposal-01",
  "timeOptionId": "option-01",
  "places": [
    {
      "placeId": "example-place-01",
      "name": "정릉 스터디룸 A",
      "coordinates": { "latitude": 37.61, "longitude": 126.99 },
      "detailUrl": "https://example.com/example-place-01",
      "checkedAt": "2026-11-04T12:00:00+09:00",
      "maxTravelMinutes": null,
      "travelTimeDifference": null,
      "rank": null,
      "recommendationReason": "일부 구성원의 유효한 이동시간이 없어 공평성 순위를 계산할 수 없습니다.",
      "travelTimes": [
        { "memberId": "member-01", "status": "ok", "minutes": 12, "transferCount": 1, "calculationMethod": "transit_route", "checkedAt": "2026-11-04T12:00:00+09:00" },
        { "memberId": "member-02", "status": "unknown", "minutes": null, "transferCount": null, "calculationMethod": null, "checkedAt": null }
      ]
    }
  ],
  "preview": { "venueConditions": "unverified", "travelTimeBasis": "api_estimate_without_meeting_time" }
}
```

오류 응답 예시

```json
{
  "status": "error",
  "dataSource": null,
  "places": [],
  "error": {
    "code": "KAKAO_TEMPORARY_FAILURE",
    "message": "카카오 서비스에 일시적인 장애가 발생했습니다.",
    "stage": "place_search",
    "httpStatus": 503
  }
}
```

## 5. 실패 및 미확인 데이터 처리 (임시안)

- 필수 값이 빠졌거나 타입과 형식이 잘못되면 `INVALID_INPUT` 오류를 반환한다. 카카오 장소 검색 실패는 아래 원인별 코드로 반환한다. 분류되지 않은 내부 장소 검색 실패에는 `PLACE_SEARCH_FAILED`를 사용한다.
- 검색에 성공했지만 후보가 없으면 `status: "ok"`와 `places: []`를 반환한다. 장소를 찾았지만 일부 이동시간을 확인할 수 없는 경우에는 장소를 유지하고 각 이동 항목에 상태를 표시한다.
- 출발지가 없거나 경로를 확인하지 못하면 `unknown`, 이동시간 조회 중 오류가 나면 `error`로 표시한다. 두 경우 모두 `minutes`는 `null`이다. 0분은 성공한 계산 결과가 실제로 0분일 때만 사용한다. C는 `null`을 화면에서 ‘미확인’ 또는 ‘조회 실패’로 표시하고 평균이나 합계에 0분으로 넣지 않는다.
- 실제 장소 검색 API 실패는 응답 전체의 오류다. 이동시간 API 실패는 해당 구성원의 이동 항목에만 오류로 표시한다. 오프라인 `mock` 요청은 `status: "error"`, `dataSource: null`, `places: []`, `error.code: "UNSUPPORTED_DATA_MODE"`를 반환한다. 모의 테스트는 네트워크 응답을 대체하며 제품의 mock 모드와 별개다. 주소 등 확인되지 않은 선택 정보는 생략한다.

### 카카오 오류 코드 (C 연동 임시 확장)

| 코드 | 조건 |
| --- | --- |
| `KAKAO_AUTH_ERROR` | HTTP 401 |
| `KAKAO_PERMISSION_DENIED` | HTTP 403 |
| `KAKAO_QUOTA_EXCEEDED` | HTTP 429 또는 JSON 숫자 `code: -10` |
| `KAKAO_TEMPORARY_FAILURE` | HTTP 500, 502, 503, 504 |
| `KAKAO_NETWORK_ERROR` | 연결 실패 또는 시간 초과 |
| `KAKAO_INVALID_RESPONSE` | 성공 응답의 JSON 또는 데이터 형식 오류 |
| `KAKAO_REQUEST_FAILED` | 기타 API 요청 실패 |
| `KAKAO_CONFIGURATION_ERROR` | 서버의 카카오 API 키 설정 누락 |

장소 검색의 최상위 `error.code`는 기존 단일 코드 대신 위 원인별 코드를 사용한다. 출발지·경로 조회만 실패하면 기존 장소와 전체 `status: "ok"`를 유지하며, 해당 `travelTimes[]`에 선택 필드 `error`를 담는다. 오류 객체에는 `code`, 화면용 한국어 `message`, 발생 위치인 `stage`(`place_search`, `origin_search`, `transit_route`), 확인 가능한 경우 외부 서버의 `httpStatus`가 포함된다. 확인되지 않은 이동시간은 `null`이다. 카카오 원본 메시지는 전달하지 않는다. HTTP API로 포장할 때 `httpStatus`는 외부 서비스 정보이며 C 서버가 응답할 HTTP 상태와 구분한다.

## 6. 온라인 회의와 공평성 (임시안)

- `meetingMode`가 `online`이면 공통 필수 입력을 검증한 뒤 장소·경로 API 호출과 공평성 계산을 생략한다. 내부 함수는 `status: "skipped"`, `dataSource: null`, `places: []`와 입력의 세 ID를 반환한다. 오프라인에서 검색 결과가 없는 경우의 `status: "ok"`와 구분된다.
- 대중교통 경로 조회에 회의 시작 시각 `startAt`을 전달하지 않는다. 이동시간은 조회 시점의 API 추정값을 정수 분으로 반올림한 값이다. `checkedAt`은 조회 확인 시각이다.
- 공평성은 요청에 포함된 구성원이 2명 이상이고 모든 구성원의 이동시간을 확인한 장소에만 계산한다. 예를 들어 12분과 20분이면 최대 이동시간은 20분, 차이는 8분이다. 일부만 확인했거나 대상이 부족하면 두 지표와 순위는 모두 `null`이다.
- 팀 기획 기준에 따라 최장 이동시간이 짧은 곳부터 순위를 매긴다. 같으면 이동시간 차이가 작은 곳, 충족한 선호 조건 수가 많은 곳, `placeId` 문자열 오름차순으로 비교한다. 이전에는 이동시간 차이를 최장 이동시간보다 먼저 비교했다. 순위는 후보를 비교하는 값이며 배열 자체의 순서는 보장하지 않는다.

### 출발 권장 시각 함수 (별도 연동 임시안)

`recommendDepartureTime`은 기존 `travelTimes` 항목의 `memberId`, `minutes`, `status`, `checkedAt`, 선택 `error`를 받는다. C가 선택한 시간 후보의 `startAt`(시간대가 포함된 ISO 8601)과 필수 `arrivalBufferMinutes`(0 이상 정수)를 추가한다. 미리보기의 `travelTimeBasis`는 선택이며 생략하면 결과에서 `null`이다. 함수는 회의 시작에서 이동시간과 여유시간을 빼고 서울 기준으로 반환한다. 10분은 시연 예시다.

결과는 `memberId`, `minutes`, `checkedAt`, `travelTimeBasis`, `status`, `recommendedDepartureAt`을 포함한다. 정상 계산은 `ok`, 값 미확인 또는 유효하지 않은 입력은 `unknown`, 이동시간 조회 실패는 `error`다. 계산 불가 시 시각은 `null`이고 `reason`이 붙는다. 조회 실패의 사유는 `travel_time_lookup_failed`이며 입력에 오류 정보가 있으면 그대로 전달한다. 이 함수는 기존 이동시간으로 안내값을 계산하며 회의 시간대 교통을 예측하거나 `findPlaces` 응답에 필드를 추가하지 않는다.

## 7. HTTP API 응답 (임시안)

`findPlaces`의 내부 결과는 위에서 정의한 `status`를 사용한다. HTTP API로 제공할 경우 호출을 받는 계층에서 공통 응답 형식인 `ok`, `data`, `error`로 변환한다. 아래 표는 C 서버가 적용할 제안이며, 현재 D 코드는 HTTP 응답을 만들지 않는다.

| 내부 결과 | HTTP 상태 | `ok` | `data` | `error` |
| --- | --- | --- | --- | --- |
| 검색 성공 또는 온라인 생략 | 200 | `true` | 내부 결과 객체 그대로 | `null` |
| 입력 오류 | 400 | `false` | `null` | 내부 `error` 객체 |
| 장소 검색 서비스 실패 | 502 | `false` | `null` | 내부 `error` 객체 |

이동시간만 일부 실패하면 HTTP 응답은 200이며, 개별 실패는 `data.places[].travelTimes` 안에 남는다.

## 8. C와 합의해야 할 항목

- 함수 호출 방식, 최종 필드 이름과 필수 여부, 팀·구성원·장소 ID를 발급하는 주체와 ID의 유효 범위
- 검색 지역의 입력 형식, 회의 목적을 자유 문장으로 받을지 여부, 목적별 장소 우선순위와 최대 후보 수
- 필수·선호 조건의 표준 표현, 회의 시간대 운영 여부와 예약 가능 여부를 어디까지 확인할지
- 출발지를 주소와 좌표 중 무엇으로 받을지, 이동수단과 이동시간 계산 기준 시각, 정수 분으로 변환하는 방식
- 오류 코드와 재시도 기준, 결과가 없거나 일부 값이 미확인일 때 C의 화면 표시 및 정렬 방식
- 오프라인 mock 도입 여부, 미검증 후보 시연 정책, 도착 여유시간과 출발 권장 문구

- 세 ID의 소속 관계를 검증할 주체, 온라인 호출 여부, HTTP 공통 응답과 상태 코드
- 공평성 계산 대상, 미확인 값 처리, 순위와 동점 기준, 장소 및 이동 정보의 확인 시각 기준


DB 저장, 별도 서버 엔드포인트, 프런트 연결, 장소 시설·수용 인원·예약 검증은 현재 구현 범위 밖이다.
