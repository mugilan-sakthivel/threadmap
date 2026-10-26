"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Auto-scroll a log to the newest entry, unless the user has scrolled up to
 * read something; resume once they scroll back to the bottom.
 */
export function useStickToBottom(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, onScroll };
}
