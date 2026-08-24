export interface SubmissionAttempt {
  readonly attemptId: string;
  readonly formId: string;
  readonly formVersion: number;
  readonly createdAt: string;
}

export interface SubmissionAttemptStore {
  getOrCreate(formId: string, formVersion: number, idFactory?: () => string): Promise<SubmissionAttempt>;
  get(formId: string, formVersion: number): Promise<SubmissionAttempt | null>;
  clear(formId: string, formVersion: number): Promise<void>;
}

function attemptKey(namespace: string, formId: string, formVersion: number): string {
  return `${namespace}:${formId}:v${formVersion}`;
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
      !Number.isFinite(Date.parse(value.createdAt))
    ) {
      return null;
    }
    return {
      attemptId: value.attemptId,
      formId: value.formId,
      formVersion: value.formVersion,
      createdAt: value.createdAt
    };
  } catch {
    return null;
  }
}

function defaultAttemptId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function") return randomUuid.call(globalThis.crypto);
  return `attempt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createLocalStorageSubmissionAttemptStore(
  options: { readonly namespace?: string } = {}
): SubmissionAttemptStore {
  const namespace = options.namespace ?? "form_engine_attempt";
  if (namespace.trim().length === 0) throw new TypeError("Attempt namespace must not be empty.");
  const memory = new Map<string, SubmissionAttempt>();
  const inFlight = new Map<string, Promise<SubmissionAttempt>>();

  const get = async (formId: string, formVersion: number): Promise<SubmissionAttempt | null> => {
    const key = attemptKey(namespace, formId, formVersion);
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
    async getOrCreate(formId, formVersion, idFactory = defaultAttemptId) {
      const key = attemptKey(namespace, formId, formVersion);
      const pending = inFlight.get(key);
      if (pending !== undefined) return pending;
      const create = (async () => {
        const existing = await get(formId, formVersion);
        if (existing !== null) return existing;
        const attemptId = idFactory();
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
      const key = attemptKey(namespace, formId, formVersion);
      memory.delete(key);
      try {
        browserStorage()?.removeItem(key);
      } catch {
        // Clearing remains best-effort when browser storage is unavailable.
      }
    }
  };
}
