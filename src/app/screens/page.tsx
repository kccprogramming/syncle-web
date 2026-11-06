"use client";

/**
 * 화면 목록 (발표·테스트용)
 * 디자인 캔버스의 화면 번호와 실제 주소를 한눈에 보고 바로 열 수 있어요.
 * 맨 아래 버튼으로 데모 상태(확정 여부 등)를 바꾸거나 처음으로 되돌릴 수 있어요.
 */
import Link from "next/link";
import { resetDemoScheduling } from "@/lib/demo-scheduling";
import { LogoMark, Wordmark } from "@/components/Logo";
import { useDemo } from "@/lib/demo-store";

const groups: { title: string; items: [string, string, string][] }[] = [
  {
    title: "시작",
    items: [
      ["0", "스플래시", "/"],
      ["0-1", "로그인", "/login"],
      ["0-2", "초대 링크로 들어온 로그인", "/invite/7K2Q-HCI4"],
    ],
  },
  {
    title: "홈",
    items: [
      ["1-0", "처음 로그인한 홈 (팀 없음)", "/home?empty=1"],
      ["1", "홈 · 내 팀", "/home"],
      ["1-1", "내 정보", "/me"],
      ["1-2", "알림", "/notifications"],
    ],
  },
  {
    title: "팀 만들기 · 참여",
    items: [
      ["2", "새 팀 만들기", "/teams/new"],
      ["2-2", "매주 안 되는 시간 추가 (시트)", "/teams/new?sheet=weekly"],
      ["2-1", "초대 링크로 참여하기", "/join"],
    ],
  },
  {
    title: "대화방",
    items: [
      ["3", "대화방 · AI 제안 카드", "/teams/hci4"],
      ["3-1", "@AI로 AI 부르기 (부탁하기 전)", "/teams/hci4?fresh=1"],
      ["3-1-2", "AI 정리 실패 (보내기 누르면)", "/teams/hci4?fresh=1&fail=1"],
      ["3-2", "팀 메뉴", "/teams/hci4?menu=1"],
      ["3-2-1", "전체 보기 · 회의", "/teams/hci4/all?tab=meet"],
      ["3-2-2", "전체 보기 · 자료", "/teams/hci4/all?tab=files"],
      ["3-2-3", "전체 보기 · 할 일", "/teams/hci4/all?tab=tasks"],
      ["3-2-4", "팀 설정", "/teams/hci4/settings"],
      ["3-3", "지우님 화면 · AI가 가능 시간 묻기", "/teams/hci4/ask"],
      ["4", "+ 메뉴 · 자료 공유", "/teams/hci4?share=1"],
    ],
  },
  {
    title: "회의 제안",
    items: [
      ["5", "회의 제안 상세", "/proposals/p-1"],
      ["5-2", "내 응답 수정 (시트)", "/proposals/p-1?sheet=reply"],
      ["5-3", "모두 되는 시간이 없을 때", "/proposals/p-1/no-match"],
      ["6", "장소 후보", "/proposals/p-1/places"],
      ["7", "AI가 이해한 내 조건", "/proposals/p-1/conditions"],
      ["7-1", "조건 직접 추가 (시트)", "/proposals/p-1/conditions?sheet=add"],
    ],
  },
  {
    title: "확정 · 회의 후",
    items: [
      ["8", "확정된 회의 카드", "/meetings/m-1"],
      ["8-2", "참석이 어려워요 (시트)", "/meetings/m-1?sheet=absent"],
      ["9", "AI 회의록", "/meetings/m-0/minutes"],
    ],
  },
];

export default function ScreensPage() {
  const { state, update, reset } = useDemo();

  return (
    <main className="screen">
      <header className="topbar" style={{ paddingLeft: 16 }}>
        <div className="hstack gap-8 grow">
          <LogoMark size={26} />
          <Wordmark size={20} />
          <span className="t-13 t-muted">화면 목록</span>
        </div>
      </header>

      <div className="screen__body">
        <p className="t-13 t-ink2" style={{ lineHeight: 1.6 }}>
          디자인 캔버스의 화면 번호와 같아요. 누르면 그 화면이 열려요.
        </p>

        {groups.map((g) => (
          <section key={g.title} className="card card--flush">
            <h2 className="section-label" style={{ padding: "12px 16px 4px" }}>
              {g.title}
            </h2>
            {g.items.map(([no, name, href]) => (
              <Link key={href} href={href} className="row" style={{ borderTop: "1px solid var(--line-2)" }}>
                <span className="tag tag--soft" style={{ minWidth: 44, textAlign: "center" }}>
                  {no}
                </span>
                <span className="t-14 grow">{name}</span>
                <span className="t-12 t-muted">{href}</span>
              </Link>
            ))}
          </section>
        ))}

        <section className="card">
          <h2 className="section-label">데모 상태</h2>
          <div className="hstack gap-10">
            <span className="t-14 grow">11/11 회의 확정됨</span>
            <button
              type="button"
              role="switch"
              aria-checked={state.confirmed}
              aria-label="회의 확정 상태"
              className={`switch${state.confirmed ? " switch--on" : ""}`}
              onClick={() => update({ confirmed: !state.confirmed })}
            />
          </div>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => {
            reset();
            resetDemoScheduling();
          }}>
            처음 상태로 되돌리기
          </button>
        </section>
      </div>
    </main>
  );
}
