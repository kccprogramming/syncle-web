"use client";

import { useEffect } from "react";

/**
 * 아래에서 올라오는 시트. open이 true일 때만 보여요.
 * 바깥(어두운 부분)을 누르거나 Esc를 누르면 onClose가 불려요.
 */
export function Sheet({
  open,
  onClose,
  title,
  sub,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
  label?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button className="backdrop" aria-label="닫기" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-label={label ?? (typeof title === "string" ? title : undefined)}>
        <div className="sheet__grip" />
        {title || sub ? (
          <div className="stack gap-2">
            {title ? <h2 className="sheet__title">{title}</h2> : null}
            {sub ? <span className="t-13 t-muted">{sub}</span> : null}
          </div>
        ) : null}
        {children}
      </section>
    </>
  );
}
