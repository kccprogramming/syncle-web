export type KakaoStage = 'place_search' | 'origin_search' | 'transit_route';

const messages = {
  KAKAO_AUTH_ERROR: '카카오 API 인증에 실패했습니다.',
  KAKAO_PERMISSION_DENIED: '카카오 API 사용 권한을 확인해 주세요.',
  KAKAO_QUOTA_EXCEEDED: '카카오 API 사용 한도를 초과했습니다.',
  KAKAO_TEMPORARY_FAILURE: '카카오 서비스에 일시적인 장애가 발생했습니다.',
  KAKAO_NETWORK_ERROR: '카카오 서버에 연결하지 못했거나 응답 시간이 초과되었습니다.',
  KAKAO_INVALID_RESPONSE: '카카오 응답 형식을 확인할 수 없습니다.',
  KAKAO_REQUEST_FAILED: '카카오 API 요청을 처리하지 못했습니다.',
  KAKAO_CONFIGURATION_ERROR: '서버의 카카오 API 설정을 확인해 주세요.',
} as const;

export type KakaoErrorCode = keyof typeof messages;
export type KakaoErrorDetail = {
  code: KakaoErrorCode;
  message: string;
  stage: KakaoStage;
  httpStatus?: number;
};

export class KakaoApiError extends Error {
  readonly detail: KakaoErrorDetail;

  constructor(code: KakaoErrorCode, stage: KakaoStage, httpStatus?: number) {
    super(messages[code]);
    this.detail = { code, message: this.message, stage, ...(httpStatus === undefined ? {} : { httpStatus }) };
  }
}

export async function fetchKakaoJson(url: URL, stage: KakaoStage): Promise<unknown> {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) throw new KakaoApiError('KAKAO_CONFIGURATION_ERROR', stage);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });
  } catch {
    throw new KakaoApiError('KAKAO_NETWORK_ERROR', stage);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (response.ok) {
      const code = error instanceof SyntaxError ? 'KAKAO_INVALID_RESPONSE' : 'KAKAO_NETWORK_ERROR';
      throw new KakaoApiError(code, stage, response.status);
    }
  }

  const status = response.status;
  if (body && typeof body === 'object' && 'code' in body && body.code === -10) {
    throw new KakaoApiError('KAKAO_QUOTA_EXCEEDED', stage, status);
  }
  if (response.ok) return body;

  const codes: Partial<Record<number, KakaoErrorCode>> = {
    401: 'KAKAO_AUTH_ERROR',
    403: 'KAKAO_PERMISSION_DENIED',
    429: 'KAKAO_QUOTA_EXCEEDED',
    500: 'KAKAO_TEMPORARY_FAILURE',
    502: 'KAKAO_TEMPORARY_FAILURE',
    503: 'KAKAO_TEMPORARY_FAILURE',
    504: 'KAKAO_TEMPORARY_FAILURE',
  };
  throw new KakaoApiError(codes[status] ?? 'KAKAO_REQUEST_FAILED', stage, status);
}

export function kakaoErrorDetail(error: unknown, stage: KakaoStage): KakaoErrorDetail {
  return error instanceof KakaoApiError ? error.detail : new KakaoApiError('KAKAO_REQUEST_FAILED', stage).detail;
}
