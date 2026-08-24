import type { ExtensibleNode, FormSchema, JsonValue, SchemaIssue, VersionTransitionPlan } from "./types";

export type Result<T, E> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

export type FormVersionStatus = "draft" | "published" | "archived";

export interface FormVersionRecord extends ExtensibleNode {
  readonly formId: string;
  readonly version: number;
  readonly status: FormVersionStatus;
  readonly schema: FormSchema;
  readonly revision: number;
  readonly createdFromVersion?: number;
  readonly createdAt: string;
  readonly publishedAt?: string;
  readonly archivedAt?: string;
}

export interface FormVersionState {
  readonly formId: string;
  readonly draftVersion?: number;
  readonly publishedVersion?: number;
  readonly nextVersion: number;
  readonly revision: number;
}

export interface VersionTransitionEvent {
  readonly type: "draft.created" | "draft.deleted" | "version.published" | "version.archived";
  readonly formId: string;
  readonly fromRevision: number;
  readonly toRevision: number;
  readonly affectedVersions: readonly number[];
  readonly occurredAt: string;
}

export type VersionTransitionError =
  | { readonly type: "draft_already_exists"; readonly currentDraftVersion: number }
  | { readonly type: "draft_not_found" }
  | { readonly type: "missing_published_record"; readonly expectedVersion: number }
  | { readonly type: "revision_conflict"; readonly expectedRevision: number; readonly actualRevision: number }
  | { readonly type: "invalid_source_version"; readonly requestedVersion: number; readonly publishedVersion?: number }
  | { readonly type: "version_immutable"; readonly status: FormVersionStatus }
  | { readonly type: "max_version_exceeded"; readonly max: number }
  | { readonly type: "validation_failed"; readonly issues: readonly SchemaIssue[] };

export interface CloneVersionOptions {
  readonly maxVersions?: number;
  readonly expectedRevision?: number;
  readonly clonedAt?: string;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  /** Additional known published versions that may be used as a clone source. */
  readonly allowedSourceVersions?: readonly number[];
}

export interface PublishDraftOptions {
  readonly expectedRevision?: number;
  readonly currentPublishedRecord?: FormVersionRecord;
  readonly validate?: (
    schema: FormSchema
  ) => boolean | Promise<boolean> | readonly SchemaIssue[] | Promise<readonly SchemaIssue[]>;
  readonly publishedAt?: string;
  /** @deprecated Use publishedAt. */
  readonly timestamp?: string;
}

export interface DeleteDraftOptions {
  readonly expectedRevision?: number;
  readonly deletedAt?: string;
}

export interface PublishDraftResult {
  readonly nextState: FormVersionState;
  readonly publishedRecord: FormVersionRecord;
  readonly archivedRecords: readonly FormVersionRecord[];
  /** @deprecated Read archivedRecords instead. */
  readonly archivedVersion?: number;
}

function revisionConflict(
  state: FormVersionState,
  expectedRevision: number | undefined
): { readonly success: false; readonly error: VersionTransitionError } | undefined {
  return expectedRevision === undefined || expectedRevision === state.revision
    ? undefined
    : {
        success: false,
        error: { type: "revision_conflict", expectedRevision, actualRevision: state.revision }
      };
}

function validateState(state: FormVersionState): void {
  if (state.formId.trim().length === 0) throw new TypeError("formId must not be empty.");
  if (!Number.isSafeInteger(state.nextVersion) || state.nextVersion < 1) {
    throw new TypeError("nextVersion must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) {
    throw new TypeError("revision must be a non-negative safe integer.");
  }
}

function requireTimestamp(value: string | undefined, name: string): string {
  const timestamp = value ?? "1970-01-01T00:00:00.000Z";
  if (!Number.isFinite(Date.parse(timestamp))) throw new TypeError(`${name} must be a valid date string.`);
  return timestamp;
}

function transitionEvent(
  type: VersionTransitionEvent["type"],
  state: FormVersionState,
  nextState: FormVersionState,
  affectedVersions: readonly number[],
  occurredAt: string
): VersionTransitionEvent {
  return {
    type,
    formId: state.formId,
    fromRevision: state.revision,
    toRevision: nextState.revision,
    affectedVersions,
    occurredAt
  };
}

export function cloneVersionToDraft(
  state: FormVersionState,
  sourceSchema: FormSchema,
  options: CloneVersionOptions = {}
): Result<{ readonly nextState: FormVersionState; readonly draftSchema: FormSchema }, VersionTransitionError> {
  validateState(state);
  if (sourceSchema.id !== state.formId) throw new TypeError("sourceSchema.id must match state.formId.");
  const conflict = revisionConflict(state, options.expectedRevision);
  if (conflict !== undefined) return conflict;
  if (state.draftVersion !== undefined) {
    return { success: false, error: { type: "draft_already_exists", currentDraftVersion: state.draftVersion } };
  }
  const allowedSourceVersions = new Set([
    ...(state.publishedVersion === undefined ? [] : [state.publishedVersion]),
    ...(options.allowedSourceVersions ?? [])
  ]);
  if (!allowedSourceVersions.has(sourceSchema.version)) {
    return {
      success: false,
      error: {
        type: "invalid_source_version",
        requestedVersion: sourceSchema.version,
        ...(state.publishedVersion === undefined ? {} : { publishedVersion: state.publishedVersion })
      }
    };
  }
  const maxVersions = options.maxVersions ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(maxVersions) || maxVersions < 1) {
    throw new TypeError("maxVersions must be a positive safe integer.");
  }
  if (state.nextVersion > maxVersions) {
    return { success: false, error: { type: "max_version_exceeded", max: maxVersions } };
  }
  const version = state.nextVersion;
  return {
    success: true,
    value: {
      nextState: {
        ...state,
        draftVersion: version,
        nextVersion: version + 1,
        revision: state.revision + 1
      },
      draftSchema: { ...sourceSchema, version }
    }
  };
}

export function createCloneTransitionPlan(
  state: FormVersionState,
  sourceRecord: FormVersionRecord,
  options: CloneVersionOptions = {}
): Result<{ readonly nextState: FormVersionState; readonly plan: VersionTransitionPlan }, VersionTransitionError> {
  if (
    sourceRecord.formId !== state.formId ||
    sourceRecord.schema.id !== sourceRecord.formId ||
    sourceRecord.schema.version !== sourceRecord.version ||
    (sourceRecord.status !== "published" && !options.allowedSourceVersions?.includes(sourceRecord.version))
  ) {
    return {
      success: false,
      error: {
        type: "invalid_source_version",
        requestedVersion: sourceRecord.version,
        ...(state.publishedVersion === undefined ? {} : { publishedVersion: state.publishedVersion })
      }
    };
  }
  const result = cloneVersionToDraft(state, sourceRecord.schema, options);
  if (!result.success) return result;
  const timestamp = requireTimestamp(options.clonedAt, "clonedAt");
  const draftRecord: FormVersionRecord = {
    formId: state.formId,
    version: result.value.draftSchema.version,
    status: "draft",
    schema: result.value.draftSchema,
    revision: 1,
    createdFromVersion: sourceRecord.version,
    createdAt: timestamp,
    ...(options.metadata === undefined ? {} : { metadata: options.metadata })
  };
  return {
    success: true,
    value: {
      nextState: result.value.nextState,
      plan: {
        formId: state.formId,
        expectedRevision: options.expectedRevision ?? state.revision,
        nextRevision: result.value.nextState.revision,
        draftToCreate: draftRecord,
        events: [transitionEvent("draft.created", state, result.value.nextState, [draftRecord.version], timestamp)],
        nextVersion: result.value.nextState.nextVersion,
        timestamp
      }
    }
  };
}

function validatePublishedRecord(
  state: FormVersionState,
  record: FormVersionRecord | undefined
): { readonly success: false; readonly error: VersionTransitionError } | undefined {
  if (state.publishedVersion !== undefined && record?.version !== state.publishedVersion) {
    return {
      success: false,
      error: { type: "missing_published_record", expectedVersion: state.publishedVersion }
    };
  }
  if (record === undefined) return undefined;
  if (
    record.formId !== state.formId ||
    record.status !== "published" ||
    record.schema.id !== record.formId ||
    record.schema.version !== record.version
  ) {
    throw new TypeError("currentPublishedRecord must match the state's published version.");
  }
  return undefined;
}

function transitionTimestamp(options: PublishDraftOptions): string {
  return requireTimestamp(options.publishedAt ?? options.timestamp, "publishedAt");
}

export async function publishDraft(
  state: FormVersionState,
  draftSchema: FormSchema,
  options: PublishDraftOptions = {}
): Promise<Result<PublishDraftResult, VersionTransitionError>> {
  validateState(state);
  const conflict = revisionConflict(state, options.expectedRevision);
  if (conflict !== undefined) return conflict;
  if (
    state.draftVersion === undefined ||
    draftSchema.id !== state.formId ||
    draftSchema.version !== state.draftVersion
  ) {
    return { success: false, error: { type: "draft_not_found" } };
  }
  const publishedRecordError = validatePublishedRecord(state, options.currentPublishedRecord);
  if (publishedRecordError !== undefined) return publishedRecordError;
  const validation = await options.validate?.(draftSchema);
  if (validation === false || (Array.isArray(validation) && validation.length > 0)) {
    return {
      success: false,
      error: { type: "validation_failed", issues: Array.isArray(validation) ? validation : [] }
    };
  }
  const timestamp = transitionTimestamp(options);
  const archivedVersion = state.publishedVersion;
  const archivedRecords: readonly FormVersionRecord[] =
    options.currentPublishedRecord === undefined
      ? []
      : [
          {
            ...options.currentPublishedRecord,
            status: "archived",
            revision: options.currentPublishedRecord.revision + 1,
            archivedAt: timestamp
          }
        ];
  const { draftVersion: _draftVersion, ...stateWithoutDraft } = state;
  return {
    success: true,
    value: {
      nextState: {
        ...stateWithoutDraft,
        publishedVersion: draftSchema.version,
        revision: state.revision + 1
      },
      publishedRecord: {
        formId: state.formId,
        version: draftSchema.version,
        status: "published",
        schema: draftSchema,
        revision: 1,
        ...(archivedVersion === undefined ? {} : { createdFromVersion: archivedVersion }),
        createdAt: timestamp,
        publishedAt: timestamp
      },
      archivedRecords,
      ...(archivedVersion === undefined ? {} : { archivedVersion })
    }
  };
}

export async function createPublishTransitionPlan(
  state: FormVersionState,
  draftRecord: FormVersionRecord,
  options: PublishDraftOptions = {}
): Promise<
  Result<{ readonly nextState: FormVersionState; readonly plan: VersionTransitionPlan }, VersionTransitionError>
> {
  if (
    draftRecord.formId !== state.formId ||
    draftRecord.version !== state.draftVersion ||
    draftRecord.schema.id !== draftRecord.formId ||
    draftRecord.schema.version !== draftRecord.version
  ) {
    return { success: false, error: { type: "draft_not_found" } };
  }
  if (draftRecord.status !== "draft") {
    return { success: false, error: { type: "version_immutable", status: draftRecord.status } };
  }
  const expectedRevision = options.expectedRevision ?? state.revision;
  const timestamp = transitionTimestamp(options);
  const result = await publishDraft(state, draftRecord.schema, {
    ...options,
    expectedRevision,
    publishedAt: timestamp
  });
  if (!result.success) return result;
  const publishedRecordToSave: FormVersionRecord = {
    ...draftRecord,
    status: "published",
    revision: draftRecord.revision + 1,
    publishedAt: timestamp
  };
  return {
    success: true,
    value: {
      nextState: result.value.nextState,
      plan: {
        formId: state.formId,
        expectedRevision,
        nextRevision: result.value.nextState.revision,
        draftToDeleteVersion: draftRecord.version,
        publishedRecordToSave,
        archivedRecordsToSave: result.value.archivedRecords,
        events: [
          ...(result.value.archivedRecords.length === 0
            ? []
            : [
                transitionEvent(
                  "version.archived",
                  state,
                  result.value.nextState,
                  result.value.archivedRecords.map((record) => record.version),
                  timestamp
                )
              ]),
          transitionEvent("version.published", state, result.value.nextState, [draftRecord.version], timestamp)
        ],
        nextVersion: result.value.nextState.nextVersion,
        timestamp
      }
    }
  };
}

export function deleteDraft(
  state: FormVersionState,
  options: DeleteDraftOptions = {}
): Result<{ readonly nextState: FormVersionState }, VersionTransitionError> {
  validateState(state);
  const conflict = revisionConflict(state, options.expectedRevision);
  if (conflict !== undefined) return conflict;
  if (state.draftVersion === undefined) return { success: false, error: { type: "draft_not_found" } };
  const { draftVersion: _draftVersion, ...stateWithoutDraft } = state;
  return {
    success: true,
    value: { nextState: { ...stateWithoutDraft, revision: state.revision + 1 } }
  };
}

export function createDeleteDraftTransitionPlan(
  state: FormVersionState,
  draftRecord: FormVersionRecord,
  options: DeleteDraftOptions = {}
): Result<{ readonly nextState: FormVersionState; readonly plan: VersionTransitionPlan }, VersionTransitionError> {
  if (
    draftRecord.formId !== state.formId ||
    draftRecord.version !== state.draftVersion ||
    draftRecord.status !== "draft" ||
    draftRecord.schema.id !== state.formId ||
    draftRecord.schema.version !== draftRecord.version
  ) {
    return { success: false, error: { type: "draft_not_found" } };
  }
  const result = deleteDraft(state, options);
  if (!result.success) return result;
  const timestamp = requireTimestamp(options.deletedAt, "deletedAt");
  return {
    success: true,
    value: {
      nextState: result.value.nextState,
      plan: {
        formId: state.formId,
        expectedRevision: options.expectedRevision ?? state.revision,
        nextRevision: result.value.nextState.revision,
        draftToDeleteVersion: draftRecord.version,
        events: [transitionEvent("draft.deleted", state, result.value.nextState, [draftRecord.version], timestamp)],
        nextVersion: result.value.nextState.nextVersion,
        timestamp
      }
    }
  };
}

export function assertVersionMutable(status: FormVersionStatus): void {
  if (status !== "draft") {
    const error: VersionTransitionError = { type: "version_immutable", status };
    throw new TypeError(`A ${status} form version is immutable.`, { cause: error });
  }
}
