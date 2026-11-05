import type { Member } from "@/types";

export function Avatar({ member, size = 36 }: { member: Pick<Member, "initial" | "color" | "ink">; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: member.color, color: member.ink, fontSize: Math.round(size * 0.4) }}
    >
      {member.initial}
    </span>
  );
}

export function AvatarStack({ members, size = 28 }: { members: Pick<Member, "id" | "initial" | "color" | "ink">[]; size?: number }) {
  return (
    <div className="avatar-stack">
      {members.map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
    </div>
  );
}

/** 팀 아이콘 (네모난 한 글자) */
export function TeamBadge({ initial, color, ink, size = 44 }: { initial: string; color: string; ink: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.27), background: color, color: ink, fontSize: Math.round(size * 0.36), fontWeight: 700 }}
    >
      {initial}
    </span>
  );
}
