import {
  type BaseSubmissionMetadata,
  createSubmission,
  createSubmissionId,
  type FormSchema,
  type FormValues,
  type JsonValue,
  type StrictFormSubmission,
  type SubmissionIdFormat
} from "@form-engine-ts/core";
import {
  createLocalStorageSubmissionAttemptStore,
  type SubmissionAttempt,
  type SubmissionAttemptScope,
  type SubmissionAttemptStore
} from "./attempt";
import type { SubmissionReceipt, SubmissionReceiptStore } from "./receipt";

export interface SubmissionIdentityOptions<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
  readonly schema: FormSchema;
  readonly scope: SubmissionAttemptScope;
  readonly idFormat?: SubmissionIdFormat;
  readonly attemptStore?: SubmissionAttemptStore;
  readonly receiptStore?: SubmissionReceiptStore;
  readonly attemptIdFactory?: () => string;
  readonly metadata?: TMeta;
}

export interface SubmissionIdentity<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata> {
  readonly schema: FormSchema;
  readonly scope: SubmissionAttemptScope;
  readonly idFormat: SubmissionIdFormat;
  readonly attemptStore: SubmissionAttemptStore;
  readonly receiptStore?: SubmissionReceiptStore;
  getOrCreateAttempt(): Promise<SubmissionAttempt>;
  createSubmission(values: FormValues, locale?: string, submittedAt?: string): Promise<StrictFormSubmission<TMeta>>;
  getReceipt(): Promise<SubmissionReceipt | null>;
  saveReceipt(receipt: SubmissionReceipt): Promise<void>;
  clear(): Promise<void>;
}

export function createSubmissionIdentity<TMeta extends BaseSubmissionMetadata = BaseSubmissionMetadata>(
  options: SubmissionIdentityOptions<TMeta>
): SubmissionIdentity<TMeta> {
  if (options.scope.formId !== options.schema.id || options.scope.formVersion !== options.schema.version) {
    throw new TypeError("Submission identity scope must match the schema.");
  }
  const idFormat = options.idFormat ?? "uuid";
  const attemptStore = options.attemptStore ?? createLocalStorageSubmissionAttemptStore({ idFormat });
  const receiptScope = {
    ...(options.scope.deckId === undefined ? {} : { deckId: options.scope.deckId }),
    ...(options.scope.sessionId === undefined ? {} : { sessionId: options.scope.sessionId }),
    ...(options.scope.userId === undefined ? {} : { userId: options.scope.userId }),
    ...(options.scope.tenantId === undefined ? {} : { tenantId: options.scope.tenantId })
  };
  const metadata =
    options.metadata === undefined
      ? undefined
      : (Object.fromEntries(
          Object.entries(options.metadata).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
        ) as TMeta & Readonly<Record<string, JsonValue>>);
  let attempt: SubmissionAttempt | undefined;
  const getOrCreateAttempt = async (): Promise<SubmissionAttempt> => {
    if (attempt !== undefined) return attempt;
    const idFactory = options.attemptIdFactory ?? (() => createSubmissionId(idFormat));
    attempt =
      attemptStore.getOrCreateForScope === undefined
        ? await attemptStore.getOrCreate(options.scope.formId, options.scope.formVersion, idFactory)
        : await attemptStore.getOrCreateForScope(options.scope, idFormat, options.attemptIdFactory);
    return attempt;
  };
  return {
    schema: options.schema,
    scope: { ...options.scope },
    idFormat,
    attemptStore,
    ...(options.receiptStore === undefined ? {} : { receiptStore: options.receiptStore }),
    getOrCreateAttempt,
    async createSubmission(values, locale, submittedAt) {
      const currentAttempt = await getOrCreateAttempt();
      const effectiveLocale = locale ?? options.schema.defaultLocale ?? options.schema.supportedLocales?.[0] ?? "und";
      return createSubmission(options.schema, values, {
        id: currentAttempt.attemptId,
        locale: effectiveLocale,
        submittedAt: submittedAt ?? new Date().toISOString(),
        ...(metadata === undefined ? {} : { metadata })
      }) as StrictFormSubmission<TMeta>;
    },
    async getReceipt() {
      return options.receiptStore?.get(options.scope.formId, options.scope.formVersion, receiptScope) ?? null;
    },
    async saveReceipt(receipt) {
      if (options.receiptStore === undefined) return;
      await options.receiptStore.save({ ...receipt, ...receiptScope });
    },
    async clear() {
      attempt = undefined;
      if (attemptStore.clearForScope !== undefined) await attemptStore.clearForScope(options.scope);
      else await attemptStore.clear(options.scope.formId, options.scope.formVersion);
      await options.receiptStore?.remove(options.scope.formId, options.scope.formVersion, receiptScope);
    }
  };
}
