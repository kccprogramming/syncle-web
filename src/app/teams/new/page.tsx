"use client";

/**
 * 2 새 팀 만들기 (2-2 매주 안 되는 시간 시트).
 * ?sheet=weekly 이면 시트가 열린 상태로 시작해요. ?sheet=origin 이면 출발지 시트가 열려요.
 * 로그인했으면 진짜 팀을 만들고(A create_team → 초대 코드) 진짜 초대 링크를 복사해요.
 * 출발지 · 매주 안 되는 시간은 내 정보(1-1)와 같은 값(Supabase)을 보여주고 저장해요.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { Toast, useToast } from "@/components/Toast";
import { EMPTY_DRAFT, WeeklyBlockSheet, formatBlock, type WeeklyDraft } from "@/components/home/WeeklyBlockSheet";
import { OriginPickerSheet } from "@/components/home/OriginPickerSheet";
import { createTeam as createLiveTeam, getMe, inviteUrl, loadMyProfile, originForD, saveMyOrigin, saveMyWeekly, type MyProfile } from "@/lib/data";
import { useAuthUser } from "@/lib/use-auth-user";
import { useDemo } from "@/lib/demo-store";
import type { WeeklyBlock } from "@/types";

// 데모용 초대 링크 · 팀 (로그인하면 진짜 값을 써요)
const INVITE_URL = "https://syncle.app/invite/7K2Q-HCI4";
const NEW_TEAM_ID = "hci4"; // 데모: 예시 대화만 있고 AI에게 아직 부탁하기 전 대화방(?fresh=1)으로 가요

// 처음 화면에 보이는 '매주 안 되는 시간' (원본 디자인과 같게 하나만)
const START_BLOCKS: WeeklyBlock[] = [{ id: "wb-1", days: ["화"], allDay: false, start: "14:00", end: "18:00", memo: "알바" }];

// ?sheet=weekly 로 열 때 미리 채워 둘 값 (발표용 예시)
const PREVIEW_DRAFT: WeeklyDraft = { days: ["월", "수"], allDay: false, start: "10:00", end: "12:00", memo: "수업" };

export default function NewTeamPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const { state, update } = useDemo();
  const toast = useToast();

  const user = useAuthUser();
  const live = !!user;
  const [name, setName] = useState("HCI 팀프로젝트 4조");
  // 로그인했으면 내 정보(1-1)에 저장된 출발지 · 매주 안 되는 시간을 같이 써요
  const [profile, setProfile] = useState<MyProfile | null>(null);
  useEffect(() => {
    if (!user) return;
    setName("");
    setBlocks([]);
    loadMyProfile().then(setProfile).catch(() => toast.show("내 정보를 불러오지 못했어요"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const origin = live
    ? profile?.origin
      ? { name: profile.origin, roadAddress: "", area: profile.area ?? "" }
      : null
    : state.origin;
  const savedWeekly = live ? (profile?.weekly ?? []) : [];
  const [originOpen, setOriginOpen] = useState(sp.get("sheet") === "origin");
  const [blocks, setBlocks] = useState<WeeklyBlock[]>(START_BLOCKS);
  const [aiOn, setAiOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // 시트: 처음에 ?sheet=weekly 면 예시 값으로, '+ 추가'로 열면 빈 값으로
  const [sheet, setSheet] = useState<WeeklyDraft | null>(sp.get("sheet") === "weekly" ? PREVIEW_DRAFT : null);

  async function createTeam() {
    let url = INVITE_URL;
    if (live) {
      if (!name.trim()) return toast.show("팀 이름을 입력해 주세요");
      setBusy(true);
      try {
        const { teamId, inviteCode } = await createLiveTeam(name, aiOn);
        // 여기서 추가한 매주 안 되는 시간은 내 정보에도 저장해요
        if (blocks.length) await saveMyWeekly([...savedWeekly, ...blocks.map(formatBlock)]);
        setCreatedId(teamId);
        url = inviteUrl(inviteCode);
      } catch (e) {
        setBusy(false);
        return toast.show(e instanceof Error ? `팀을 만들지 못했어요 · ${e.message}` : "팀을 만들지 못했어요");
      }
      setBusy(false);
    } else {
      update({ newTeamName: name.trim() || "새 팀", aiEnabled: aiOn });
    }
    setCopied(true);
    try {
      await navigator.clipboard.writeText(url);
      toast.show("팀을 만들고 초대 링크를 복사했어요");
    } catch {
      toast.show(`팀을 만들었어요 · 초대 링크: ${url}`);
    }
  }

  return (
    <main className="screen screen--white">
      <TopBar back="/home" backLabel="홈으로 돌아가기" plain />

      <div className="screen__body" style={{ padding: "8px 20px 20px", gap: 22 }}>
        <div className="stack gap-8">
          <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.35 }}>새 팀 만들기</h1>
          <p className="t-14 t-ink2" style={{ lineHeight: 1.6 }}>
            팀원들과 평소처럼 대화하면, 회의가 필요할 때 AI가 시간과 장소를 정리해 제안해요.
          </p>
        </div>

        <div className="field">
          <label htmlFor="team" className="field__label">팀 이름</label>
          <input id="team" className="input" type="text" value={name} placeholder="팀명을 입력해주세요" disabled={copied} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <span id="origin-label" className="field__label">주로 출발하는 곳</span>
          <button
            type="button"
            aria-label={`주로 출발하는 곳 ${origin ? `${origin.name}, ${origin.roadAddress}. 바꾸기` : "찾기"}`}
            onClick={() => setOriginOpen(true)}
            className="input hstack gap-10"
            style={{ height: "auto", minHeight: 56, padding: "8px 14px", textAlign: "left" }}
          >
            <span style={{ color: "var(--accent)", display: "inline-flex", flexShrink: 0 }}>
              <Icon name="pin" size={20} />
            </span>
            {origin ? (
              <span className="stack gap-2" style={{ flex: "1 1 auto", minWidth: 0 }}>
                <span className="t-15 t-strong t-ellipsis">{origin.name}</span>
                {origin.roadAddress ? <span className="t-12 t-muted t-ellipsis">{origin.roadAddress}</span> : null}
              </span>
            ) : (
              <span className="t-15 t-muted" style={{ flex: "1 1 auto" }}>역이나 건물 이름으로 찾기</span>
            )}
            <span className="t-13 t-accent t-strong" style={{ flexShrink: 0 }}>{origin ? "변경" : "찾기"}</span>
          </button>
          <span className="field__hint">팀원에게는 {origin?.area ? `‘${origin.area}’까지만` : "동네 단위까지만"} 보여요</span>
        </div>

        <div className="field">
          <span className="field__label">매주 안 되는 시간 (선택)</span>
          <div className="hstack gap-8" style={{ flexWrap: "wrap" }}>
            {savedWeekly.map((line, i) => (
              <span key={`saved-${i}`} className="chip chip--soft" style={{ padding: "0 12px" }} title="내 정보에 저장된 시간">
                {line}
              </span>
            ))}
            {blocks.map((b) => (
              <span key={b.id} className="chip chip--soft" style={{ padding: "0 4px 0 12px", gap: 2 }}>
                {formatBlock(b)}
                <button
                  type="button"
                  aria-label={`${formatBlock(b)} 삭제`}
                  onClick={() => setBlocks(blocks.filter((x) => x.id !== b.id))}
                  className="hstack"
                  style={{ width: 28, height: 28, border: 0, borderRadius: 14, background: "none", color: "var(--accent-strong)", justifyContent: "center" }}
                >
                  <Icon name="close" size={14} strokeWidth={2.4} />
                </button>
              </span>
            ))}
            <button type="button" className="chip chip--dashed" onClick={() => setSheet(EMPTY_DRAFT)}>
              + 추가
            </button>
          </div>
        </div>

        <section className="stack gap-10" style={{ background: "var(--bg)", borderRadius: "var(--radius-l)", padding: 16 }}>
          <label className="hstack gap-10" style={{ minHeight: 44 }}>
            <input
              type="checkbox"
              checked={aiOn}
              onChange={(e) => setAiOn(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: "var(--accent)", margin: 0 }}
            />
            <span className="t-15 t-strong">AI 회의 도우미 켜기</span>
          </label>
          <ul className="stack gap-4 t-13 t-ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55 }}>
            <li>이 팀 대화방의 메시지만 읽어요. 개인 메시지는 읽지 않아요.</li>
            <li>제안은 초안이고, 확정은 팀원이 해요.</li>
            <li>언제든 끌 수 있어요.</li>
          </ul>
        </section>
      </div>

      <footer className="footer footer--bare" style={{ padding: "12px 20px 24px", gap: 10 }}>
        {copied ? (
          <>
            <Link href={createdId ? `/teams/${createdId}` : `/teams/${NEW_TEAM_ID}?fresh=1`} className="btn btn--primary btn--lg btn--block">
              대화방으로 가기
            </Link>
            <span className="footer__note" style={{ fontSize: 12 }}>팀원에게 링크를 보내면 설치 없이 바로 참여해요</span>
          </>
        ) : (
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={createTeam} disabled={busy}>
            {busy ? "팀을 만드는 중…" : "팀 만들고 초대 링크 복사"}
          </button>
        )}
      </footer>

      <Toast {...toast} bottom={120} />

      {originOpen && (
        <OriginPickerSheet
          initial={live ? null : state.origin}
          onClose={() => setOriginOpen(false)}
          onPick={(place) => {
            update({ origin: place });
            setOriginOpen(false);
            if (live) setProfile((p) => (p ? { ...p, origin: originForD(place), area: place.area } : p));
            saveMyOrigin(getMe().id, place).catch(() => toast.show("출발지를 저장하지 못했어요"));
          }}
        />
      )}

      {sheet && (
        <WeeklyBlockSheet
          initial={sheet}
          onClose={() => setSheet(null)}
          onAdd={(block) => {
            setBlocks([...blocks, block]);
            setSheet(null);
          }}
        />
      )}
    </main>
  );
}
