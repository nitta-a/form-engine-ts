export type FormEventType = "response.submitted" | "schema.updated";

export interface FormEvent<T = unknown> {
  readonly id: string;
  readonly type: FormEventType;
  readonly formId: string;
  readonly timestamp: string;
  readonly payload: T;
}

export interface WebhookConfig {
  readonly url: string;
  readonly secret?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

export interface WebhookDispatchResult {
  readonly success: boolean;
  readonly status?: number;
  readonly error?: string;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signPayload(payload: string, secret: string): Promise<string> {
  if (globalThis.crypto?.subtle === undefined) throw new Error("Web Crypto is unavailable for webhook signing.");
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToHex(await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

export async function dispatchWebhook<T>(
  event: FormEvent<T>,
  config: WebhookConfig,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<WebhookDispatchResult> {
  const body = JSON.stringify(event);
  const controller = new AbortController();
  const timeoutMs = config.timeoutMs ?? 5000;
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { "content-type": "application/json", ...config.headers };
    if (config.secret !== undefined) {
      headers["X-Form-Engine-Signature"] = await signPayload(body, config.secret);
    }
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal
    });
    return response.ok
      ? { success: true, status: response.status }
      : { success: false, status: response.status, error: `Webhook returned HTTP ${response.status}.` };
  } catch (cause) {
    const error = controller.signal.aborted
      ? `Webhook request timed out after ${timeoutMs}ms.`
      : cause instanceof Error
        ? cause.message
        : String(cause);
    return { success: false, error };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
