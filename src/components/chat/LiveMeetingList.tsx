"use client";

/**
 * 진짜 팀의 회의 목록 (C · c_schedule_list) — 팀 메뉴의 '회의'와 전체 보기 회의 탭에서 써요.
 * 응답 중인 제안은 파란 테두리, 확정된 회의는 초록 테두리. 누르면 C 화면(/proposals/{id}).
 */
import Link from "next/link";
import { seoulLabel, type loadTeamProposals } from "@/lib/data";

export type LiveProposalRow = Awaited<ReturnType<typeof loadTeamProposals>>[number];

export function LiveMeetingList({ list, empty }: { list: LiveProposalRow[] | null; empty: string }) {
  if (list === null) return <span className="t-13 t-muted">불러오는 중…</span>;
  if (list.length === 0) return <span className="t-13 t-muted">{empty}</span>;
  return (
    <>
      {list.map((p) => {
        const confirmed = p.status === "confirmed" && p.meeting;
        const where = p.meeting ? (p.meeting.mode === "online" ? "온라인" : (p.meeting.place?.name ?? "")) : "";
        return (
          <Link
            key={p.id}
            href={`/proposals/${p.id}`}
            className="stack gap-2"
            style={{
              border: `1.5px solid ${confirmed ? "var(--ok)" : "var(--accent)"}`,
              background: confirmed ? "var(--ok-bg-2)" : "var(--accent-softer)",
              borderRadius: 12,
              padding: "10px 12px",
              color: "var(--ink)",
            }}
          >
            <span className="t-14 t-strong">{p.title}</span>
            <span className="t-12 t-ink2">
              {confirmed && p.meeting
                ? `확정 · ${seoulLabel(p.meeting.startAt)}${where ? ` · ${where}` : ""}`
                : `응답 ${p.respondedCount}/${p.totalCount}명 · 마감 ${seoulLabel(p.responseDeadline)}`}
            </span>
          </Link>
        );
      })}
    </>
  );
}
