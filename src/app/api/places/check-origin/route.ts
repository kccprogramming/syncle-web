/**
 * GET /api/places/check-origin?q=<D에 넘길 출발지 글자>  → { ok: boolean, reason?: string }
 * 출발지를 고를 때, D(현규)가 그 글자로 위치를 정확히 찾을 수 있는지 미리 확인해요.
 * 예: '구로역광장'처럼 주소가 동네까지만 있는 곳은 여러 곳과 겹쳐서 이동시간을 계산할 수 없어요.
 * 좌표는 돌려주지 않아요 (카카오 응답을 따로 저장·전달하지 않기 위해).
 */
import { NextResponse, type NextRequest } from "next/server";
import { resolveOrigin } from "@/server/d/resolveOrigin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!q) return NextResponse.json({ ok: false, reason: "empty" });
  if (!process.env.KAKAO_REST_API_KEY) return NextResponse.json({ ok: true, reason: "no_key" }); // 데모: 확인할 수 없으니 통과
  try {
    const r = (await resolveOrigin(q)) as { status: string; reason?: string };
    return NextResponse.json({ ok: r.status === "ok", reason: r.reason ?? r.status });
  } catch {
    return NextResponse.json({ ok: true, reason: "check_failed" }); // 확인이 잠시 안 되면 막지 않아요
  }
}
