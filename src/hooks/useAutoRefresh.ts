import { useCallback, useEffect, useRef, useState } from "react";

export const AUTO_REFRESH_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "5s", value: 5_000 },
  { label: "10s", value: 10_000 },
  { label: "1min", value: 60_000 },
] as const;

export type AutoRefreshInterval = (typeof AUTO_REFRESH_OPTIONS)[number]["value"];

/**
 * Manages a polling interval that calls `onRefresh` every `interval` ms.
 * When `interval` is 0, polling is disabled.
 */
export function useAutoRefresh(onRefresh: () => void, defaultInterval: AutoRefreshInterval = 0) {
  const [interval, setInterval] = useState<AutoRefreshInterval>(defaultInterval);
  const callbackRef = useRef(onRefresh);

  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (interval === 0) return;

    const id = globalThis.setInterval(() => callbackRef.current(), interval);
    return () => globalThis.clearInterval(id);
  }, [interval]);

  const setIntervalStable = useCallback((v: AutoRefreshInterval) => setInterval(v), []);

  return { autoRefreshInterval: interval, setAutoRefreshInterval: setIntervalStable };
}
