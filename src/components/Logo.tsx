/**
 * 싱클 로고: 말풍선 안에 연결된 점 세 개.
 * inverted=true면 파란 배경 위에 쓰는 흰색 버전이에요.
 */
export function LogoMark({ size = 30, inverted = false, label }: { size?: number; inverted?: boolean; label?: string }) {
  const fill = inverted ? "#FFFFFF" : "var(--accent)";
  const ink = inverted ? "var(--accent)" : "#FFFFFF";
  const heavy = size < 40; // 작게 쓸 때는 선을 굵게
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d="M28 12H68A18 18 0 0 1 86 30V52A18 18 0 0 1 68 70H44L28 84V70A18 18 0 0 1 10 52V30A18 18 0 0 1 28 12Z" fill={fill} />
      <path d="M31 50L48 30L65 50Z" stroke={ink} strokeWidth={heavy ? 6 : 4} strokeLinejoin="round" />
      <circle cx="48" cy="30" r={heavy ? 9 : 7} fill={ink} />
      <circle cx="31" cy="50" r={heavy ? 9 : 7} fill={ink} />
      <circle cx="65" cy="50" r={heavy ? 9 : 7} fill={ink} />
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span style={{ fontFamily: "var(--font-brand)", fontSize: size, fontWeight: 700, letterSpacing: -0.3 }}>Syncle</span>
  );
}

/** 대화방에서 싱클 AI 프로필 동그라미 */
export function AiAvatar({ size = 36 }: { size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: "var(--accent)" }}>
      <LogoMark size={Math.round(size * 0.62)} inverted />
    </div>
  );
}
