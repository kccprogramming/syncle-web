# SUNGHA-FIXED v2 — B 추출·검증·개인 확인 데이터

Node.js 22 이상 / npm. 검증 환경은 Node.js 24다.

## 설치 및 API 없는 검증

```sh
npm ci
npm run typecheck
npm test
npm run check
```

package-lock.json이 없으면 최초에 npm install로 생성한다.
위 테스트는 Gemini에 연결하지 않는다. 주입한 응답/오류로 검증한다.
테스트 개별 항목의 실패가 명령 종료 상태에 반영된다.

## 이번 검토의 6개 항목 대응

1. **메시지 시각 분리**:
   validateMessageTimestamp는 명시적인 시간대가 있는 ISO 시각을 받는다.
   UTC Z/+00:00, 다른 오프셋, 초, 소수초 1~9자리를 허용한다.
   예: 2026-11-04T09:00:37.123456+00:00.
   잘못된 달력 날짜·시계·오프셋·시간대 없는 문자열은 거부한다.
   원본 sentAt을 변환하거나 덮어쓰지 않으므로 마이크로초도 원문에 보존된다.
   반환되는 JS epoch 값은 밀리초 정밀도이며 DB 저장값 대체용이 아니다.
   회의 구간/searchWindow/referenceDate의 기존 KST·분 단위 검증과 분리했다.

2. **회의 잡기 표현**:
   @AI 회의 잡아줘 / 이번 주 회의 잡자 / 미팅 잡아줘,
   회의를/미팅을 잡아줘를 schedule로 분류한다.

3. **MVP 범위 제한**:
   A는 handleAiRequest를 호출한다.
   장소·안건·요약 요청은 status=not_supported,
   message="아직 준비 중이에요"를 반환한다.
   이 경로에서는 AI 추출 함수에 진입하지 않는다.
   ignore/clarify도 API를 호출하지 않는다.
   키워드 기반 라우터이므로 복합/불명확한 요청은 clarify_request다.

4. **일정 초안 + 카드 DTO**:
   목적/회의 길이/대면 여부 등 기본 조건이 유효하면
   미응답자가 있어도 needs_confirmation에 draft: Conditions를 함께 반환한다.
   draft에는 모든 참석자의 원래 상태와 검증된 구간이 담긴다.
   C에서 후보를 받으면 buildConfirmationCards로
   제안 ID/후보 ID/시작·종료/대상자를 연결한다.

5. **질문 대상**:
   필수 여부와 관계없이 missing/needs_confirmation이거나
   availableSlots가 없는 사람을 질문 대상으로 포함한다.
   불가만 말한 사람도 포함한다.
   C의 동일 proposalId에 selected/declined_all 응답이 있으면 다시 묻지 않는다.
   pending 또는 저장 응답이 없는 사람만 카드를 만든다.

6. **자동 테스트**:
   기존 51개에 DB 시각/대표 표현/API 미호출/일정 초안/카드/
   제안별 응답/잘못된 후보 및 응답 검사 51개를 추가했다.
   총 102개다.

## B → A → C → 프런트 흐름

### 1) A의 요청 진입점

```ts
const result = await handleAiRequest(messageText, input);
```

- ignored: 아무 요청도 처리하지 않는다.
- not_supported: 반환된 message를 A가 저장/전달한다. 추가 AI 호출은 하지 않는다.
- clarify_request: 회의 잡기 요청을 명확히 하도록 안내한다.
- needs_confirmation, draft 없음:
  회의 기본 조건 질문을 먼저 해결한다. C 후보 계산 전이다.
- needs_confirmation, draft 있음:
  C에 result.draft.schedule을 전달해 잠정 후보를 만든다.
- ready:
  기본 조건과 모든 팀원의 명시적 가능 구간이 확보된 추출 결과다.
  이 상태도 실제 예약/최종 확정을 뜻하지는 않는다.

기존 analyzeMessages는 저수준 추출 함수다.
MVP 요청 라우팅에는 handleAiRequest를 사용한다.

### 2) C의 잠정 후보 입력

C는 검증된 draft.schedule을 받는다.
미응답자를 가능하다고 간주하지 말고,
확정 응답/검색 범위/불가 구간을 이용해 확인용 잠정 후보를 만든다.
실제 최종 전원 참석 후보와 구분한다.

이 ZIP의 schedule.ts/findCandidates는 확정 응답용 참고 계산기이므로
미응답자가 있는 잠정 후보 생성기로 사용하지 않는다.

실제 C 구현은 이 ZIP에 없으며
C 어댑터에서 초안 처리 연결이 필요하다.

### 3) C → B 후보 규격 (CandidateProposal)

```json
{
  "proposalId": "proposal-1",
  "teamId": "team-example",
  "candidates": [
    {
      "candidateId": "c1",
      "startAt": "2026-11-10T19:00:00+09:00",
      "endAt": "2026-11-10T20:00:00+09:00"
    },
    {
      "candidateId": "c2",
      "startAt": "2026-11-10T20:00:00+09:00",
      "endAt": "2026-11-10T21:00:00+09:00"
    }
  ]
}
```

proposalId는 C가 생성하는 불변 제안 버전이다.
후보 목록/시간이 변경되면 새 proposalId를 사용한다.

B는 팀 ID, ID 중복, 회의 길이, 날짜, 검색 범위를 검사한다.
후보의 최적성/가능성/생성 정책 자체는 C의 책임이다.

### 4) C의 현재 저장 응답 (CandidateResponse[])

```json
[
  {
    "proposalId": "proposal-1",
    "memberId": "u2",
    "responseStatus": "declined_all",
    "selectedCandidateIds": []
  }
]
```

- pending: selectedCandidateIds=[]
- selected: 해당 제안에 존재하는 후보 ID 1개 이상
- declined_all: selectedCandidateIds=[]

원시 응답 이력 전체가 아니라
(proposalId, memberId)별 최신 상태 한 건을 C가 반환한다.

중복 현재 상태/알 수 없는 후보/상태와 선택 불일치는 거부한다.
이전 제안에 대한 거절은 새 제안의 질문을 막지 않는다.

후보를 선택/거절한 후 최종 참석 가능 여부를 다시 계산하는 작업은
C가 담당한다.

### 5) B의 질문 카드 데이터 생성

```ts
if (result.status === 'needs_confirmation' && result.draft) {
  // 다음 두 값은 실제 C 어댑터에서 가져온다.
  const proposal = await C.createDraftProposal(result.draft.schedule);
  const responses = await C.getCurrentResponses(proposal.proposalId);
  const cards = buildConfirmationCards(result, proposal, responses);
  // A가 cards를 대상자별 비공개 저장/전달하고 프런트가 표시한다.
}
```

위 C 함수 이름은 연결 예시이며 ZIP에 구현된 함수가 아니다.

카드에는 다음 정보가 들어간다.

- type
- proposalId
- teamId
- targetMemberId
- question
- 후보별 candidateId/startAt/endAt
- allowDeclineAll=true

알려진 불가 시간과 겹치는 선택지는 해당 사람의 카드에서 제외한다.
후보가 없거나 모든 선택지가 알려진 불가 구간에 걸리면 빈 카드는 만들지 않는다.
이때 A/C는 후보 재생성 또는 후보 없음 안내로 처리하고
같은 질문을 반복하지 않는다.

일정 확인 UI는 raw questions가 아니라
C 응답을 반영한 cards를 사용한다.

questions는 B의 확인 필요 항목 목록이다.
이를 그대로 반복 전송하면 C의 declined_all을 반영할 수 없으므로
카드 생성 단계를 반드시 거친다.

A는 (proposalId, targetMemberId)를 고유 키로 저장/upsert하여
재호출 중복 전송을 막는다.

이 DTO는 이번 수정본에서 제안한 규격이다.
지우(C)의 실제 필드명/어댑터와 대조가 필요하다.
C와 이미 합의하거나 실제 서비스에서 연동 검증한 것으로 주장하지 않는다.

## 기존 수정 사항 유지

- 응답 타입/날짜/양의 정수/상태/필수 필드/입력에 존재하는 ID 검증
- 입력과 다른 팀·필수 참석자·검색 기간은 덮어쓰지 않고 거부
- 깊은 복사로 입력 및 응답 원본과 참조 분리
- Mock은 EXAMPLE_B_INPUT과 정확히 같은 고정 예시만 지원
- 정보 부족은 null → 확인 요청; 필드 누락/잘못된 타입은 오류
- 선호 시간은 preferredSlots이며 확정 가능 시간으로 간주하지 않음
- 불가만 말한 경우 나머지 시간을 가능으로 채우지 않음
- HTTP/JSON/검증 오류는 그대로 전달하고 API 원문/키는 로깅하지 않음

## 담당 범위와 미검증 사항

- B: 추출, 검증, 일정 초안, 질문/카드 데이터
- A: 채팅 이벤트 연결, 비공개 저장·전달, 중복 전송 방지
- 프런트: 카드 표시, 선택·다 안 돼요 응답 전달
- C: 잠정/최종 후보 계산, 제안 ID 관리, 현재 응답 저장·조회

UI/비공개 DB 저장/실제 C 후보 계산은 구현하지 않았다.
이번 검증은 모의 C와 주입한 Gemini 응답만 사용한다.

실제 Gemini 자연어 정확도/실제 Supabase 접속/
실제 C 통합 테스트는 하지 않았다.

실제 호출에는 GEMINI_API_KEY가 필요하며 .env를 자동 로딩하지 않는다.
GEMINI_MODEL로 모델을 지정할 수 있다.
기본 모델은 원본 이름을 유지했다.

정상 예시의 19–20/20–21 두 후보와,
19–21 / 20:30–22:30이 30분만 겹칠 때
60분 후보가 없는 결과도 유지한다.

## 공유

소스·테스트·README·package.json·package-lock.json·tsconfig.json만
ZIP에 포함한다.

.env, 실제 API 키, node_modules는 포함하지 않는다.

## 공유본 검토 보완

원본 ZIP의 mvp.test.ts가 mvp.ts와 중복되어 이전 전달본의 정상 테스트 4개로 복구했습니다. 기능 구현 파일은 바꾸지 않았습니다. node_modules 및 실제 환경변수 파일을 제외하는 .gitignore와 키가 비어 있는 .env.example을 추가했습니다. .env.example 복사만으로 파일이 자동 로딩되지는 않습니다. 기본 검사에는 API 키가 필요 없습니다.

## 장소 종류 및 합주·회식 요청 추가

- AI 출력에 placeType: string | null 필드를 추가했다.
- 예: 합주실, 음식점, 카페, 스터디룸.
- AI가 전체 대화 문맥으로 추출하며 B가 낱말 규칙으로 다시 분류하지 않는다.
- 장소 종류를 판단하기 어려우면 null이다.
- 온라인 모임의 placeType은 null이다.
- placeRequirements는 방음·인원·콘센트 등 추가 조건으로 유지한다.
- 합주/회식 잡아줘 및 합주를/회식을 잡아줘를 일정 요청으로 분류한다.
- 별도 장소 추천 요청은 기존 MVP 정책대로 미지원이며 API를 호출하지 않는다.
- 기존 102개와 추가 22개, 총 124개 테스트를 통과했다.
- 실제 Gemini 호출 없이 모의 응답으로 검사했다.
- 실제 Gemini의 장소 종류 추출 정확도를 검증한 것은 아니다.

장소 추천 소비자는 conditions.placeType 또는 draft.placeType을 읽도록 연결해야 한다.
이 ZIP에는 외부 장소 추천기의 낱말 규칙 코드가 포함되어 있지 않으므로
그 외부 코드까지 교체한 것은 아니다.

기존 저장 JSON과 외부 테스트 fixture에도 placeType을 명시해야 한다.
