import "server-only";

import { createClient } from "@supabase/supabase-js";

export type PrivateTeamOrigin = {
  memberId: string;
  origin: string | null;
};

export class TeamOriginLoadError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TeamOriginLoadError";
  }
}

/**
 * Loads private origins for server-side travel calculations only.
 *
 * Call this from a server route after receiving the user's bearer token. The
 * returned origins must stay in server memory and be passed only to the
 * calculation provider. Never return, log, or persist this array in a client
 * response. The public response should contain only memberId, minutes, and
 * status (with null minutes and "unknown" status when an origin is missing).
 */
export async function loadPrivateTeamOriginsForCalculation(
  request: Request,
  teamId: string,
): Promise<PrivateTeamOrigin[]> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token) {
    throw new TeamOriginLoadError(401, "LOGIN_REQUIRED", "먼저 로그인해 주세요.");
  }
  if (!url || !publishableKey || !serviceRoleKey) {
    throw new TeamOriginLoadError(503, "SUPABASE_NOT_CONFIGURED", "서버 Supabase 설정이 필요해요.");
  }
  if (!teamId.trim()) {
    throw new TeamOriginLoadError(400, "INVALID_TEAM", "팀 정보가 필요해요.");
  }

  // Verify the user's token with the publishable key, then check team membership
  // using that same user's permissions before any privileged read.
  const userDb = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userDb.auth.getUser(token);
  if (authError || !authData.user) {
    throw new TeamOriginLoadError(401, "LOGIN_REQUIRED", "로그인 상태를 확인해 주세요.");
  }

  const { data: membership, error: membershipError } = await userDb
    .from("team_members")
    .select("member_id")
    .eq("team_id", teamId)
    .eq("member_id", authData.user.id)
    .maybeSingle();

  if (membershipError) {
    throw new TeamOriginLoadError(503, "DB_ERROR", "팀 참여 정보를 확인하지 못했어요.");
  }
  if (!membership) {
    throw new TeamOriginLoadError(403, "FORBIDDEN", "이 팀의 구성원만 계산할 수 있어요.");
  }

  // This privileged client is intentionally created only on the server. The
  // database function grants EXECUTE to service_role only and checks membership
  // again. Never expose this client or its key to browser code.
  const serviceDb = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await serviceDb.rpc("get_team_private_origins_for_calculation", {
    p_team_id: teamId,
    p_requesting_user_id: authData.user.id,
  });

  if (error || !Array.isArray(data)) {
    throw new TeamOriginLoadError(503, "ORIGIN_LOOKUP_FAILED", "팀원 출발지를 계산 서버에서 읽지 못했어요.");
  }

  return data.map((row: { member_id: string; departure_origin: string | null }) => ({
    memberId: row.member_id,
    origin: typeof row.departure_origin === "string" && row.departure_origin.trim()
      ? row.departure_origin.trim()
      : null,
  }));
}
