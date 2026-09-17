import { useState } from "react";

export interface SharePayload {
  readonly title: string;
  readonly text: string;
  readonly url?: string;
}

export type ShareStatus = "idle" | "shared" | "copied" | "error";

export interface UseShareOptions {
  readonly onShare?: (payload: SharePayload) => void | Promise<void>;
}

export function useShare(options: UseShareOptions = {}) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const supported =
    options.onShare !== undefined ||
    (typeof navigator !== "undefined" &&
      (typeof navigator.share === "function" || typeof navigator.clipboard?.writeText === "function"));

  const share = async (payload: SharePayload): Promise<ShareStatus> => {
    try {
      if (options.onShare !== undefined) {
        await options.onShare(payload);
        setStatus("shared");
        return "shared";
      }
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(payload);
        setStatus("shared");
        return "shared";
      }
      if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText([payload.text, payload.url].filter(Boolean).join("\n"));
        setStatus("copied");
        return "copied";
      }
      throw new Error("Sharing is not supported.");
    } catch {
      setStatus("error");
      return "error";
    }
  };

  return { share, status, supported } as const;
}
