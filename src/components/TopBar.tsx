import Link from "next/link";
import { Icon } from "./Icon";

/**
 * 화면 맨 위 바. 뒤로 가기, 제목, 오른쪽 버튼들.
 * back에 주소를 주면 뒤로 가기 버튼이 그 주소로 가요.
 */
export function TopBar({
  back,
  backLabel = "뒤로",
  title,
  sub,
  right,
  plain = false,
}: {
  back?: string;
  backLabel?: string;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  plain?: boolean;
}) {
  return (
    <header className={`topbar${plain ? " topbar--plain" : ""}`}>
      {back ? (
        <Link href={back} className="icon-btn" aria-label={backLabel}>
          <Icon name="back" size={22} strokeWidth={2} />
        </Link>
      ) : (
        <span style={{ width: 12 }} />
      )}
      <div className="topbar__titles">
        {title ? <h1 className="topbar__title">{title}</h1> : null}
        {sub ? <span className="topbar__sub">{sub}</span> : null}
      </div>
      {right}
    </header>
  );
}
