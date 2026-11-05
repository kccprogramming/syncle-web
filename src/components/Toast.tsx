"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/**
 * 잠깐 떴다 사라지는 알림.
 *   const toast = useToast();
 *   toast.show("초대 링크가 복사되었어요");
 *   ...
 *   <Toast {...toast} />
 */
export function useToast(duration = 2500) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string) => {
      setMessage(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), duration);
    },
    [duration],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { message, show };
}

export function Toast({ message, bottom }: { message: string | null; bottom?: number }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" style={bottom !== undefined ? { bottom } : undefined}>
      <div className="toast__box">
        <Icon name="check" size={18} strokeWidth={2.4} color="#8FE3A8" />
        {message}
      </div>
    </div>
  );
}
