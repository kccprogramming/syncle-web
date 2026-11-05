/**
 * 대화에서 "어떤 장소를 잡아야 하는지" 고르기 (합주실 · 회의 장소 · 회식 장소 …).
 *
 * B(회의 조건 추출)가 대화에서 뽑은 목적·필요한 장소·안건을 넣으면, 카카오에서 찾을 장소 종류(keyword)와
 * 그렇게 고른 근거(reason)를 돌려줘요. 6 장소 후보는 이 keyword로 D에게 장소를 찾아 달라고 해요.
 *
 * 지금은 낱말 규칙으로 골라요. B의 출력에 장소 종류(placeType)를 추가하기로 합의하면,
 * B가 준 값을 먼저 쓰고 이 규칙은 비상용으로만 남기면 돼요.
 */
export interface PlaceIntent {
  /** 카카오 키워드 검색에 쓰는 장소 종류 (예: 합주실, 맛집) */
  keyword: string;
  /** 화면에 보여줄 이름 (예: 합주실, 회식 장소) */
  label: string;
  /** 고른 근거 (디자인 원칙 5: AI는 근거를 같이 보여줘요) */
  reason: string;
}

/** 위에서부터 먼저 맞는 규칙을 써요 (더 구체적인 것을 위에) */
const RULES: { test: RegExp; keyword: string; label: string }[] = [
  { test: /합주|밴드|연주|리허설|공연\s*연습|악기|드럼|기타\s*연습/, keyword: "합주실", label: "합주실" },
  { test: /노래방|코노|노래\s*연습/, keyword: "노래방", label: "노래방" },
  { test: /촬영|사진\s*찍|영상\s*찍|스튜디오/, keyword: "촬영 스튜디오", label: "촬영 스튜디오" },
  { test: /회식|뒤풀이|종강|쫑파티|저녁\s*(?:먹|식사)|밥\s*먹|술\s*(?:한잔|마시)|맛집|식사|축하\s*파티/, keyword: "맛집", label: "회식 장소" },
  { test: /스터디\s*카페/, keyword: "스터디카페", label: "스터디카페" },
  { test: /보드\s*게임/, keyword: "보드게임카페", label: "보드게임카페" },
  { test: /(?<!스터디\s*)카페|커피/, keyword: "카페", label: "카페" },
  { test: /회의|미팅|발표|과제|스터디|공부|노트북|자료|역할\s*분담|기획|프로젝트/, keyword: "스터디룸", label: "회의 장소" },
];

const DEFAULT_INTENT = { keyword: "스터디룸", label: "회의 장소" };

/**
 * texts: 근거가 될 글 (B의 purpose, placeRequirements, agenda, 또는 대화 메시지)
 * 근거 문장은 맞은 낱말이 들어 있는 글을 짧게 인용해요.
 */
export function inferPlaceIntent(texts: (string | null | undefined)[]): PlaceIntent {
  const list = texts.map((t) => (t ?? "").trim()).filter(Boolean);
  for (const rule of RULES) {
    const hit = list.find((t) => rule.test.test(t));
    if (hit) {
      const plain = hit.replace(/@AI\s*/gi, "").trim();
      const quote = plain.length > 24 ? `${plain.slice(0, 24)}…` : plain;
      return { keyword: rule.keyword, label: rule.label, reason: `대화에서 ‘${quote}’${hasBatchim(quote) ? "이라고" : "라고"} 했어요` };
    }
  }
  return { ...DEFAULT_INTENT, reason: "대화에서 장소 종류를 찾지 못해 회의 장소로 찾았어요" };
}

/** '@AI … 잡아줘' 같은 일정 잡기 부탁인지 (회의뿐 아니라 합주·회식·모임도) */
export function isSchedulingRequest(text: string): boolean {
  if (/회의록/.test(text)) return false;
  return /회의|미팅|합주|회식|모임|뒤풀이|약속|만나|스터디|연습/.test(text) && /잡|정해|언제|날짜|시간/.test(text);
}

/** "합주실이었어요" / "회의 장소였어요" — 마지막 글자 받침에 맞춰 붙여요 */
export function wasLabel(label: string): string {
  return `${label}${hasBatchim(label) ? "이었어요" : "였어요"}`;
}

/** 마지막 글자에 받침이 있는지 (한글이 아니면 false) */
function hasBatchim(text: string): boolean {
  const last = text.charCodeAt(text.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
}
