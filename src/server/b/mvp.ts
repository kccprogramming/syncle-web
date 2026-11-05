import type {
  Conditions,
  ExtractionInput,
  Slot,
  CandidateProposal,
  CandidateResponse,
  ConfirmationCard,
} from './b-c-contract';

import {
  analyzeMessages,
  ConfirmationRequiredError,
  type ExtractionResult,
  type GenerateText,
  validateConditions,
  validateExtraction,
  validateMeetingSlot,
} from './extractor';

export type RequestKind =
  | 'schedule'
  | 'place'
  | 'agenda'
  | 'summary'
  | 'clarify'
  | 'ignore';

/** 명시적인 @AI 요청만 분류한다. */
export function classifyRequest(
  text: string,
): RequestKind {
  if (
    !/(?:^|[^A-Za-z0-9_@])@AI(?=$|\s|[,:!?])/i.test(
      text,
    )
  ) {
    return 'ignore';
  }

  const kinds: RequestKind[] = [];

  if (
    /일정|시간|언제|(?:회의|미팅)\s*(?:[을를]\s*)?잡/.test(
      text,
    )
  ) {
    kinds.push('schedule');
  }

  if (/장소|어디/.test(text)) {
    kinds.push('place');
  }

  if (/안건/.test(text)) {
    kinds.push('agenda');
  }

  if (
    /요약|정리/.test(text) &&
    !/안건/.test(text)
  ) {
    kinds.push('summary');
  }

  return kinds.length === 1
    ? kinds[0]
    : 'clarify';
}

/**
 * 프런트/A에서 사용자가 확인한 절대 시간 구간을 전달한다.
 * 자유문장만 보고 날짜를 임의로 추측하지 않는다.
 */
export function applyDirectCondition(
  current: Conditions,
  input: ExtractionInput,
  condition: {
    memberId: string;
    sourceMessageId: string;
    kind: 'unavailable' | 'preferred';
    slot: Slot;
  },
): Conditions {
  const source = input.messages.find(
    m => m.id === condition.sourceMessageId,
  );

  if (
    !source ||
    source.senderId !== condition.memberId
  ) {
    throw new Error(
      'Condition requires a message from the member',
    );
  }

  const next = structuredClone(current);

  const member = next.schedule.members.find(
    m => m.memberId === condition.memberId,
  );

  if (!member) {
    throw new Error('Unknown member');
  }

  if (condition.kind === 'preferred') {
    (member.preferredSlots ??= []).push(
      structuredClone(condition.slot),
    );
  } else if (
    condition.kind === 'unavailable'
  ) {
    member.unavailableSlots.push(
      structuredClone(condition.slot),
    );

    const a = Date.parse(
      condition.slot.startAt,
    );
    const b = Date.parse(
      condition.slot.endAt,
    );

    member.availableSlots =
      member.availableSlots.flatMap(s => {
        if (
          Date.parse(s.startAt) >= b ||
          Date.parse(s.endAt) <= a
        ) {
          return [s];
        }

        const parts: Slot[] = [];

        if (Date.parse(s.startAt) < a) {
          parts.push({
            startAt: s.startAt,
            endAt: condition.slot.startAt,
          });
        }

        if (Date.parse(s.endAt) > b) {
          parts.push({
            startAt: condition.slot.endAt,
            endAt: s.endAt,
          });
        }

        return parts;
      });

    if (
      member.responseStatus === 'missing'
    ) {
      member.responseStatus = 'provided';
    }
  } else {
    throw new Error(
      'Unknown direct condition kind',
    );
  }

  next.sourceMessageIds = [
    ...new Set([
      ...next.sourceMessageIds,
      source.id,
    ]),
  ];

  return validateConditions(next, input);
}

/**
 * draft가 있으면 C의 확인용 잠정 후보 계산에 전달할 수 있다.
 * ready와 잠정 초안을 구분한다.
 */
export async function analyzeForScheduling(
  input: ExtractionInput,
  generate?: GenerateText,
): Promise<ExtractionResult> {
  try {
    return validateExtraction(
      await analyzeMessages(input, generate),
      input,
    );
  } catch (e) {
    if (
      e instanceof ConfirmationRequiredError
    ) {
      return {
        status: 'needs_confirmation',
        questions: e.questions,
      };
    }

    throw e;
  }
}

export type MvpRequestResult =
  | {
      status: 'ignored';
    }
  | {
      status: 'not_supported';
      requestKind:
        | 'place'
        | 'agenda'
        | 'summary';
      message: string;
    }
  | {
      status: 'clarify_request';
      message: string;
    }
  | ExtractionResult;

/**
 * A에서 호출할 MVP 진입점.
 * 미지원 요청은 API 호출 경로에 진입하지 않는다.
 */
export async function handleAiRequest(
  text: string,
  input: ExtractionInput,
  generate?: GenerateText,
): Promise<MvpRequestResult> {
  const kind = classifyRequest(text);

  if (kind === 'ignore') {
    return {
      status: 'ignored',
    };
  }

  if (
    kind === 'place' ||
    kind === 'agenda' ||
    kind === 'summary'
  ) {
    return {
      status: 'not_supported',
      requestKind: kind,
      message: '아직 준비 중이에요',
    };
  }

  if (kind === 'clarify') {
    return {
      status: 'clarify_request',
      message:
        '현재는 회의 잡기만 지원해요. 회의 일정을 요청해 주세요.',
    };
  }

  return analyzeForScheduling(
    input,
    generate,
  );
}

function nonempty(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
}

/**
 * C의 후보와 저장 응답으로 비공개 질문 데이터를 만든다.
 * DB 저장이나 실제 메시지 전송은 하지 않는다.
 *
 * responses에는 제안·참석자별 최신 상태 한 건씩 전달한다.
 */
export function buildConfirmationCards(
  result: ExtractionResult,
  proposal: CandidateProposal,
  responses: CandidateResponse[] = [],
): ConfirmationCard[] {
  const draft =
    result.status === 'ready'
      ? result.conditions
      : result.draft;

  if (!draft) {
    throw new Error(
      'Core meeting facts must be confirmed before requesting C candidates',
    );
  }

  if (
    !proposal ||
    !nonempty(proposal.proposalId) ||
    proposal.teamId !==
      draft.schedule.teamId ||
    !Array.isArray(proposal.candidates)
  ) {
    throw new Error(
      'Invalid candidate proposal',
    );
  }

  const ids = new Set<string>();

  for (
    const candidate of proposal.candidates
  ) {
    if (
      !candidate ||
      !nonempty(candidate.candidateId) ||
      ids.has(candidate.candidateId)
    ) {
      throw new Error(
        'Invalid/duplicate candidate ID',
      );
    }

    ids.add(candidate.candidateId);

    const [a, b] =
      validateMeetingSlot(
        candidate,
        draft.schedule.searchWindow,
      );

    if (
      b - a !==
      draft.schedule.durationMinutes *
        60000
    ) {
      throw new Error(
        'Candidate duration mismatch',
      );
    }
  }

  if (!Array.isArray(responses)) {
    throw new Error(
      'Invalid candidate responses',
    );
  }

  const current = new Map<
    string,
    CandidateResponse
  >();

  for (const response of responses) {
    if (
      !response ||
      !nonempty(response.proposalId)
    ) {
      throw new Error(
        'Invalid response proposal ID',
      );
    }

    if (
      response.proposalId !==
      proposal.proposalId
    ) {
      continue;
    }

    if (
      !draft.schedule.members.some(
        m =>
          m.memberId ===
          response.memberId,
      ) ||
      current.has(response.memberId)
    ) {
      throw new Error(
        'Unknown/duplicate response member',
      );
    }

    if (
      ![
        'pending',
        'selected',
        'declined_all',
      ].includes(
        response.responseStatus,
      ) ||
      !Array.isArray(
        response.selectedCandidateIds,
      )
    ) {
      throw new Error(
        'Invalid response status',
      );
    }

    const selected =
      response.selectedCandidateIds;

    if (
      selected.some(
        id =>
          !nonempty(id) ||
          !ids.has(id),
      ) ||
      new Set(selected).size !==
        selected.length
    ) {
      throw new Error(
        'Invalid selected candidate IDs',
      );
    }

    if (
      (
        response.responseStatus ===
          'selected' &&
        selected.length === 0
      ) ||
      (
        response.responseStatus !==
          'selected' &&
        selected.length !== 0
      )
    ) {
      throw new Error(
        'Response status/selection mismatch',
      );
    }

    current.set(
      response.memberId,
      response,
    );
  }

  if (
    result.status === 'ready' ||
    proposal.candidates.length === 0
  ) {
    return [];
  }

  const targets = new Set(
    result.questions
      .filter(
        q => q.field === 'availability',
      )
      .map(q => q.memberId),
  );

  return draft.schedule.members.flatMap(
    member => {
      if (
        !targets.has(member.memberId)
      ) {
        return [];
      }

      const response = current.get(
        member.memberId,
      );

      // 선택 또는 전체 거절은 이미 답한 상태다.
      if (
        response &&
        response.responseStatus !==
          'pending'
      ) {
        return [];
      }

      const candidates =
        proposal.candidates.filter(
          candidate =>
            !member.unavailableSlots.some(
              block =>
                Date.parse(
                  candidate.startAt,
                ) <
                  Date.parse(
                    block.endAt,
                  ) &&
                Date.parse(
                  block.startAt,
                ) <
                  Date.parse(
                    candidate.endAt,
                  ),
            ),
        );

      if (!candidates.length) {
        return [];
      }

      return [
        {
          type:
            'availability_confirmation' as const,
          proposalId:
            proposal.proposalId,
          teamId: proposal.teamId,
          targetMemberId:
            member.memberId,
          question:
            '참석 가능한 시간을 모두 선택해 주세요. 없으면 ‘다 안 돼요’를 선택해 주세요.',
          candidates:
            structuredClone(candidates),
          allowDeclineAll: true as const,
        },
      ];
    },
  );
}