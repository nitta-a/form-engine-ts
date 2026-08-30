export interface SubmissionAttempt {
  readonly attemptId: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly createdAt: string;
  readonly deckId?: string;
  readonly sessionId?: string;
  readonly receiptId?: string;
}

export type SubmissionIdFormat = "uuid" | "ulid" | "custom";

export interface SubmissionAttemptScope {
  readonly formId: string;
  readonly formVersion: number;
  readonly deckId?: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly tenantId?: string;
}

export interface SubmissionAttemptStore {
  getOrCreate(formId: string, formVersion: number, idFactory?: () => string): Promise<SubmissionAttempt>;
  get(formId: string, formVersion: number): Promise<SubmissionAttempt | null>;
  clear(formId: string, formVersion: number): Promise<void>;
  getOrCreateForScope?(
    scope: SubmissionAttemptScope,
    idFormat?: SubmissionIdFormat,
    idFactory?: () => string
  ): Promise<SubmissionAttempt>;
  getForScope?(scope: SubmissionAttemptScope): Promise<SubmissionAttempt | null>;
  setReceiptForScope?(scope: SubmissionAttemptScope, receiptId: string): Promise<void>;
  clearForScope?(scope: SubmissionAttemptScope): Promise<void>;
}

function attemptKey(namespace: string, scope: SubmissionAttemptScope): string {
  return `${namespace}:${encodeURIComponent(JSON.stringify(scope))}`;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseAttempt(serialized: string): SubmissionAttempt | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (
      typeof value !== "object" ||
      value === null ||
      !("attemptId" in value) ||
      typeof value.attemptId !== "string" ||
      value.attemptId.length === 0 ||
      !("formId" in value) ||
      typeof value.formId !== "string" ||
      !("formVersion" in value) ||
      typeof value.formVersion !== "number" ||
      !Number.isSafeInteger(value.formVersion) ||
      !("createdAt" in value) ||
      typeof value.createdAt !== "string" ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      ("deckId" in value && value.deckId !== undefined && typeof value.deckId !== "string") ||
      ("sessionId" in value && value.sessionId !== undefined && typeof value.sessionId !== "string") ||
      ("receiptId" in value && value.receiptId !== undefined && typeof value.receiptId !== "string")
    ) {
      return null;
    }
    const record = value as Record<string, unknown>;
    return {
      attemptId: record.attemptId as string,
      formId: record.formId as string,
      formVersion: record.formVersion as number,
      createdAt: record.createdAt as string,
      ...(typeof record.deckId === "string" ? { deckId: record.deckId } : {}),
      ...(typeof record.sessionId === "string" ? { sessionId: record.sessionId } : {}),
      ...(typeof record.receiptId === "string" ? { receiptId: record.receiptId } : {})
    };
  } catch {
    return null;
  }
}

function defaultUuid(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function") return randomUuid.call(globalThis.crypto);
  return `attempt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function defaultUlid(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let timestamp = Date.now();
  let timePart = "";
  for (let index = 0; index < 10; index += 1) {
    timePart = alphabet[timestamp % 32] + timePart;
    timestamp = Math.floor(timestamp / 32);
  }
  const bytes = new Uint8Array(16);
  const getRandomValues = globalThis.crypto?.getRandomValues;
  if (typeof getRandomValues === "function") getRandomValues.call(globalThis.crypto, bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return `${timePart}${Array.from(bytes, (value) => alphabet[value % 32]).join("")}`;
}

function createAttemptId(format: SubmissionIdFormat, idFactory?: () => string): string {
  if (idFactory !== undefined) return idFactory();
  if (format === "custom") throw new TypeError("attempt idFactory is required when idFormat is custom.");
  return format === "ulid" ? defaultUlid() : defaultUuid();
}

export function createLocalStorageSubmissionAttemptStore(
  options: { readonly namespace?: string; readonly idFormat?: SubmissionIdFormat } = {}
): SubmissionAttemptStore {
  const namespace = options.namespace ?? "form_engine_attempt";
  const idFormat = options.idFormat ?? "uuid";
  if (namespace.trim().length === 0) throw new TypeError("Attempt namespace must not be empty.");
  const memory = new Map<string, SubmissionAttempt>();
  const inFlight = new Map<string, Promise<SubmissionAttempt>>();

  const get = async (formId: string, formVersion: number): Promise<SubmissionAttempt | null> => {
    const key = attemptKey(namespace, { formId, formVersion });
    const remembered = memory.get(key);
    if (remembered !== undefined) return remembered;
    const storage = browserStorage();
    if (storage === null) return null;
    try {
      const serialized = storage.getItem(key);
      if (serialized === null) return null;
      const attempt = parseAttempt(serialized);
      if (attempt === null || attempt.formId !== formId || attempt.formVersion !== formVersion) return null;
      memory.set(key, attempt);
      return attempt;
    } catch {
      return null;
    }
  };

  return {
    get,
    async getOrCreate(formId, formVersion, idFactory) {
      const key = attemptKey(namespace, { formId, formVersion });
      const pending = inFlight.get(key);
      if (pending !== undefined) return pending;
      const create = (async () => {
        const existing = await get(formId, formVersion);
        if (existing !== null) return existing;
        const attemptId = createAttemptId(idFormat, idFactory);
        if (typeof attemptId !== "string" || attemptId.trim().length === 0) {
          throw new TypeError("Attempt idFactory must return a non-empty string.");
        }
        const attempt: SubmissionAttempt = {
          attemptId,
          formId,
          formVersion,
          createdAt: new Date().toISOString()
        };
        memory.set(key, attempt);
        try {
          browserStorage()?.setItem(key, JSON.stringify(attempt));
        } catch {
          // The in-memory attempt still provides stable retries for this store instance.
        }
        return attempt;
      })();
      inFlight.set(key, create);
      try {
        return await create;
      } finally {
        inFlight.delete(key);
      }
    },
    async clear(formId, formVersion) {
      const key = attemptKey(namespace, { formId, formVersion });
      memory.delete(key);
      try {
        browserStorage()?.removeItem(key);
      } catch {
        // Clearing remains best-effort when browser storage is unavailable.
      }
    },
    async getOrCreateForScope(scope, format = idFormat, idFactory) {
      const key = attemptKey(namespace, scope);
      const remembered = memory.get(key);
      if (remembered !== undefined) return remembered;
      const storage = browserStorage();
      if (storage !== null) {
        try {
          const serialized = storage.getItem(key);
          if (serialized !== null) {
            const attempt = parseAttempt(serialized);
            if (attempt !== null && attempt.formId === scope.formId && attempt.formVersion === scope.formVersion) {
              memory.set(key, attempt);
              return attempt;
            }
          }
        } catch {
          // Continue with the in-memory store when browser storage is unavailable.
        }
      }
      const attemptId = createAttemptId(format, idFactory);
      if (attemptId.trim().length === 0) throw new TypeError("Attempt idFactory must return a non-empty string.");
      const attempt: SubmissionAttempt = {
        attemptId,
        formId: scope.formId,
        formVersion: scope.formVersion,
        createdAt: new Date().toISOString(),
        ...(scope.deckId === undefined ? {} : { deckId: scope.deckId }),
        ...(scope.sessionId === undefined ? {} : { sessionId: scope.sessionId })
      };
      memory.set(key, attempt);
      try {
        storage?.setItem(key, JSON.stringify(attempt));
      } catch {
        // The in-memory attempt still provides stable retries for this store instance.
      }
      return attempt;
    },
    async getForScope(scope) {
      const key = attemptKey(namespace, scope);
      const remembered = memory.get(key);
      if (remembered !== undefined) return remembered;
      const storage = browserStorage();
      if (storage === null) return null;
      try {
        const serialized = storage.getItem(key);
        if (serialized === null) return null;
        const attempt = parseAttempt(serialized);
        if (attempt === null || attempt.formId !== scope.formId || attempt.formVersion !== scope.formVersion)
          return null;
        memory.set(key, attempt);
        return attempt;
      } catch {
        return null;
      }
    },
    async setReceiptForScope(scope, receiptId) {
      const attempt = await this.getOrCreateForScope?.(scope);
      if (attempt === undefined) return;
      const next = { ...attempt, receiptId };
      const key = attemptKey(namespace, scope);
      memory.set(key, next);
      try {
        browserStorage()?.setItem(key, JSON.stringify(next));
      } catch {
        // Receipt persistence is best-effort.
      }
    },
    async clearForScope(scope) {
      const key = attemptKey(namespace, scope);
      memory.delete(key);
      try {
        browserStorage()?.removeItem(key);
      } catch {
        // Clearing remains best-effort when browser storage is unavailable.
      }
    }
  };
}
