"use client";

/**
 * 7 내 조건 — 진짜 팀 (C 제안). 주소: /proposals/{제안 ID}/conditions
 *
 * - AI가 이해한 내 시간: C 제안의 회의 조건(conditions.schedule.members 중 나) — 되는 · 안 되는 · 되면 좋은 시간
 * - 내 응답: 시간 후보에 고른 것 / 다 안 돼요 / 직접 알려 준 시간
 * - 매주 안 되는 시간 · 출발 위치: 내 정보(A 프로필). 출발 위치는 여기서 바로 바꿀 수 있어요
 * - '+ 이번 회의 조건 추가': C condition(안 돼요 · 되면 좋아요) — 저장하면 AI가 추천을 다시 계산해요
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Sheet } from "@/components/Sheet";
import { Toast, useToast } from "@/components/Toast";
import { OriginPickerSheet } from "@/components/home/OriginPickerSheet";
import { DatePickerSheet, dateLabel } from "@/components/DatePickerSheet";
import { loadMyProfile, originForD, saveMyOrigin, seoulLabel, type MyProfile } from "@/lib/data";
import { schedulingRequest, type LiveProposal } from "@/lib/scheduling-client";

type Slot = { startAt: string; endAt: string };

/** "11/10(화) 14:00–19:00" (날짜가 바뀌면 끝도 날짜까지) */
function slotLabel(s: Slot) {
  const a = seoulLabel(s.startAt);
  const b = seoulLabel(s.endAt);
  return a.split(" ")[0] === b.split(" ")[0] ? `${a}–${b.split(" ")[1]}` : `${a} – ${b}`;
}

/** datetime-local "2026-11-10T14:00" → "2026-11-10T14:00:00+09:00" */
const toKst = (v: string) => (v ? `${v}:00+09:00` : "");

function Row({ title, source, tone = "plain" }: { title: string; source: string; tone?: "ai" | "plain" | "no" }) {
  return (
    <div
      className="stack gap-2"
      style={{
        border: tone === "ai" ? "1.5px solid var(--accent-line)" : "1px solid var(--line)",
        background: tone === "ai" ? "var(--accent-softer)" : "var(--surface)",
        borderRadius: 12,
        padding: "9px 12px",
      }}
    >
      <span className="t-14 t-strong">{title}</span>
      <span className="t-12 t-muted t-ellipsis">{source}</span>
    </div>
  );
}

export function LiveConditions({ proposalId }: { proposalId: string }) {
  const toast = useToast();
  const [data, setData] = useState<LiveProposal | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<null | "add" | "origin">(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, me] = await Promise.all([schedulingRequest<LiveProposal>(`proposals/${proposalId}`), loadMyProfile()]);
      setData(p);
      setProfile(me);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조건을 불러오지 못했어요");
    }
  }, [proposalId]);
  useEffect(() => {
    void load();
  }, [load]);

  const back = `/proposals/${proposalId}`;
  if (!data) {
    return (
      <main className="screen">
        <TopBar back={back} backLabel="회의 제안으로" title="내 조건" />
        <div className="screen__body" style={{ alignItems: "center", justifyContent: "center" }}>
          <span className={`t-13 ${error ? "t-warn" : "t-muted"}`}>{error || "불러오는 중…"}</span>
        </div>
      </main>
    );
  }

  const mine = data.conditions.schedule.members.find((m) => m.memberId === data.viewerId);
  const ai = [
    ...(mine?.availableSlots ?? []).map((s) => ({ title: `${slotLabel(s)} 돼요`, tone: "ai" as const })),
    ...(mine?.unavailableSlots ?? []).map((s) => ({ title: `${slotLabel(s)} 안 돼요`, tone: "no" as const })),
    ...(mine?.preferredSlots ?? []).map((s) => ({ title: `${slotLabel(s)} 되면 좋아요`, tone: "ai" as const })),
  ];
  const response = data.responses.find((r) => r.memberId === data.viewerId);
  const responseLines = !response
    ? []
    : response.kind === "declined_all"
      ? ["후보 시간이 다 안 돼요"]
      : response.kind === "custom"
        ? response.customSlots.map((s) => `${slotLabel(s)} 돼요 (직접 알려 줌)`)
        : data.candidates.filter((c) => response.selectedCandidateIds.includes(c.id)).map((c) => `${slotLabel(c)} 돼요`);
  const closed = !!data.meeting;

  return (
    <main className="screen">
      <TopBar back={back} backLabel="회의 제안으로" title="내 조건" />

      <div className="screen__body" style={{ padding: "14px 16px", gap: 10 }}>
        <p className="t-13 t-ink2" style={{ lineHeight: 1.5 }}>
          AI가 대화와 내 정보에서 이해한 조건이에요. 틀리면 이번 회의 조건을 더하거나 내 응답을 고쳐 주세요.
        </p>

        <section className="card" style={{ padding: 14, gap: 8 }}>
          <h2 className="t-15 t-strong">AI가 이해한 내 시간</h2>
          {ai.length ? (
            ai.map((c, i) => <Row key={i} title={c.title} source="대화와 내가 남긴 조건에서" tone={c.tone} />)
          ) : (
            <span className="t-13 t-muted">{mine?.responseStatus === "missing" ? "대화에서 내 시간을 찾지 못했어요" : "아직 정리된 시간이 없어요"}</span>
          )}
          {closed ? null : (
            <button
              type="button"
              className="btn chip--dashed t-14"
              style={{ height: 44, borderRadius: 10, background: "var(--surface)", color: "var(--ink-2)", fontWeight: 400 }}
              onClick={() => setSheet("add")}
            >
              + 이번 회의 조건 추가
            </button>
          )}
        </section>

        <section className="card" style={{ padding: 14, gap: 8 }}>
          <div className="hstack">
            <h2 className="t-15 t-strong grow">내 응답</h2>
            {closed ? null : (
              <Link href={back} className="t-13 t-accent">
                고치기 ›
              </Link>
            )}
          </div>
          {responseLines.length ? (
            responseLines.map((l, i) => <Row key={i} title={l} source="회의 제안에서 고른 것" />)
          ) : (
            <span className="t-13 t-muted">아직 응답하지 않았어요</span>
          )}
        </section>

        <section className="card" style={{ padding: 14, gap: 8 }}>
          <div className="hstack">
            <h2 className="t-15 t-strong grow">매주 안 되는 시간</h2>
            <Link href="/me" className="t-13 t-accent">
              내 정보에서 바꾸기 ›
            </Link>
          </div>
          <div className="hstack gap-8" style={{ flexWrap: "wrap" }}>
            {profile?.weekly.length ? (
              profile.weekly.map((w, i) => (
                <span key={i} className="chip chip--soft" style={{ padding: "0 12px" }}>
                  {w}
                </span>
              ))
            ) : (
              <span className="t-13 t-muted">없어요</span>
            )}
          </div>
        </section>

        <section className="card" style={{ padding: 14, gap: 8 }}>
          <h2 className="t-15 t-strong">출발 위치</h2>
          <button type="button" className="hstack gap-10" style={{ border: 0, background: "none", padding: 0, textAlign: "left" }} onClick={() => setSheet("origin")}>
            <span className="stack gap-2 grow" style={{ minWidth: 0 }}>
              <span className="t-14 t-strong t-ellipsis">{profile?.origin ?? "아직 정하지 않았어요"}</span>
              <span className="t-12 t-muted">{profile?.area ? `팀원에게는 ‘${profile.area}’까지만 보여요` : "장소를 찾을 때 이동시간 계산에 써요"}</span>
            </span>
            <span className="t-13 t-accent no-shrink">수정 ›</span>
          </button>
        </section>
      </div>

      {sheet === "add" ? (
        <AddConditionSheet
          window={data.conditions.schedule.searchWindow}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={async (kind, slot) => {
            setBusy(true);
            try {
              const next = await schedulingRequest<LiveProposal>(`proposals/${proposalId}/condition`, { kind, slot, version: data.version });
              setData(next);
              setSheet(null);
              toast.show("조건을 추가했어요 · AI가 추천을 다시 계산해요");
            } catch (e) {
              toast.show(e instanceof Error ? e.message : "조건을 저장하지 못했어요");
              void load(); // 다른 사람이 먼저 바꿨을 수 있어요
            }
            setBusy(false);
          }}
        />
      ) : null}
      {sheet === "origin" ? (
        <OriginPickerSheet
          initial={null}
          onClose={() => setSheet(null)}
          onPick={(place) => {
            setSheet(null);
            setProfile((p) => (p ? { ...p, origin: originForD(place), area: place.area } : p));
            saveMyOrigin("", place)
              .then(() => toast.show("출발하는 곳을 바꿨어요 · 다음 장소 찾기부터 반영돼요"))
              .catch(() => toast.show("저장하지 못했어요 · 잠시 후 다시 해 주세요"));
          }}
        />
      ) : null}
      <Toast {...toast} />
    </main>
  );
}

/** ISO 시각 → datetime-local 값(서울) "2026-11-10T14:00" */
const toLocal = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 16);

function AddConditionSheet({
  window,
  busy,
  onClose,
  onSave,
}: {
  window: Slot;
  busy: boolean;
  onClose: () => void;
  onSave: (kind: "unavailable" | "preferred", slot: Slot) => void;
}) {
  const min = toLocal(window.startAt);
  const max = toLocal(window.endAt);
  // 찾는 기간의 첫날 · 마지막 날 (끝은 다음 날 0시라 1분 빼서)
  const minDate = min.slice(0, 10);
  const maxDate = toLocal(new Date(Date.parse(window.endAt) - 60_000).toISOString()).slice(0, 10);
  const [kind, setKind] = useState<"unavailable" | "preferred">("unavailable");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [picker, setPicker] = useState<null | "start" | "end">(null); // 날짜 · 시간 시트 (제안 만들기와 같은 모양)
  const ready = !!start && !!end && start < end && start >= min && end <= max;
  const label = (v: string) => (v ? `${dateLabel(v.slice(0, 10))} ${v.slice(11, 16)}` : "");
  return (
    <>
      <Sheet open onClose={onClose} title="이번 회의 조건 추가" sub={`이 회의에만 적용돼요 · ${slotLabel(window)} 안에서 · 한국 시간`}>
        <div className="hstack gap-8">
          <button type="button" aria-pressed={kind === "unavailable"} className={`chip${kind === "unavailable" ? " chip--on" : ""}`} onClick={() => setKind("unavailable")}>
            안 돼요
          </button>
          <button type="button" aria-pressed={kind === "preferred"} className={`chip${kind === "preferred" ? " chip--on" : ""}`} onClick={() => setKind("preferred")}>
            되면 좋아요
          </button>
        </div>
        <div className="hstack gap-8">
          <button type="button" className={`input grow${start ? "" : " t-muted"}`} style={{ textAlign: "left" }} aria-label={`시작 ${label(start) || "고르기"}`} onClick={() => setPicker("start")}>
            {label(start) || "시작"}
          </button>
          <span className="t-13 t-muted">~</span>
          <button type="button" className={`input grow${end ? "" : " t-muted"}`} style={{ textAlign: "left" }} aria-label={`끝 ${label(end) || "고르기"}`} onClick={() => setPicker("end")}>
            {label(end) || "끝"}
          </button>
        </div>
        {start && end && !ready ? <span className="t-12 t-warn">끝이 시작보다 늦고, 찾는 기간 안이어야 해요</span> : null}
        <button type="button" className="btn btn--primary" style={{ height: 50 }} disabled={busy || !ready} onClick={() => onSave(kind, { startAt: toKst(start), endAt: toKst(end) })}>
          {busy ? "저장하는 중…" : "조건 추가"}
        </button>
      </Sheet>
      {picker ? (
        <DatePickerSheet
          title={picker === "start" ? "언제부터인가요?" : "언제까지인가요?"}
          withTime
          value={picker === "start" ? start || `${minDate}T19:00` : end || (start ? addHour(start) : `${minDate}T20:00`)}
          min={picker === "end" && start ? start.slice(0, 10) : minDate}
          max={maxDate}
          onClose={() => setPicker(null)}
          onConfirm={(v) => {
            if (picker === "start") {
              setStart(v);
              if (!end || end <= v) setEnd(addHour(v));
            } else setEnd(v);
            setPicker(null);
          }}
        />
      ) : null}
    </>
  );
}

/** "2026-11-10T19:00" → 한 시간 뒤 "2026-11-10T20:00" */
function addHour(local: string) {
  return toLocal(new Date(Date.parse(`${local}:00+09:00`) + 3600_000).toISOString());
}
