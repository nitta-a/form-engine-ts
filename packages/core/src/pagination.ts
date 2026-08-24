export interface SubmissionCursorValue {
  readonly submittedAt: string;
  readonly responseId: string;
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;
    result += BASE64_ALPHABET[(combined >> 18) & 63] ?? "";
    result += BASE64_ALPHABET[(combined >> 12) & 63] ?? "";
    result += index + 1 < bytes.length ? (BASE64_ALPHABET[(combined >> 6) & 63] ?? "") : "=";
    result += index + 2 < bytes.length ? (BASE64_ALPHABET[combined & 63] ?? "") : "=";
  }
  return result;
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new TypeError("cursor must be a valid Base64 token.");
  }
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 4) {
    const characters = value.slice(index, index + 4);
    const sextets = [...characters].map((character) => (character === "=" ? 0 : BASE64_ALPHABET.indexOf(character)));
    const combined =
      ((sextets[0] ?? 0) << 18) | ((sextets[1] ?? 0) << 12) | ((sextets[2] ?? 0) << 6) | (sextets[3] ?? 0);
    bytes.push((combined >> 16) & 255);
    if (characters[2] !== "=") bytes.push((combined >> 8) & 255);
    if (characters[3] !== "=") bytes.push(combined & 255);
  }
  return new Uint8Array(bytes);
}

export function encodeSubmissionCursor(value: SubmissionCursorValue): string {
  if (value.submittedAt.length === 0 || value.responseId.length === 0) {
    throw new TypeError("Cursor values must not be empty.");
  }
  return encodeBase64(new TextEncoder().encode(JSON.stringify(value)));
}

export function decodeSubmissionCursor(cursor: string): SubmissionCursorValue {
  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64(cursor))) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("submittedAt" in parsed) ||
      typeof parsed.submittedAt !== "string" ||
      parsed.submittedAt.length === 0 ||
      !("responseId" in parsed) ||
      typeof parsed.responseId !== "string" ||
      parsed.responseId.length === 0
    ) {
      throw new TypeError("cursor payload is invalid.");
    }
    return { submittedAt: parsed.submittedAt, responseId: parsed.responseId };
  } catch (cause) {
    if (cause instanceof TypeError && cause.message === "cursor payload is invalid.") throw cause;
    throw new TypeError("cursor must be a valid form-engine cursor.", { cause });
  }
}

export function normalizeSubmissionPageSize(pageSize: number | undefined, fallback = 100): number {
  const value = pageSize ?? fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError("pageSize must be a positive safe integer.");
  return value;
}
