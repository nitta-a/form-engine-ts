import { useEffect, useRef } from "react";

export function useVisibilityPolling(callback: () => void, intervalMs?: number, enabled = true): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (intervalMs === undefined || intervalMs <= 0 || !enabled) return undefined;
    let timer: ReturnType<typeof globalThis.setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) globalThis.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (typeof document !== "undefined" && document.hidden) return;
      timer = globalThis.setInterval(() => callbackRef.current(), intervalMs);
    };
    start();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", start);
    return () => {
      stop();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", start);
    };
  }, [enabled, intervalMs]);
}
