import type { FormSchema } from "./types";

export type Result<T, E> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

export type FormVersionStatus = "draft" | "published" | "archived";

export interface FormVersionRecord {
  readonly formId: string;
  readonly version: number;
  readonly status: FormVersionStatus;
  readonly schema: FormSchema;
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

export type VersionTransitionError =
  | { readonly type: "draft_already_exists"; readonly currentDraftVersion: number }
  | { readonly type: "draft_not_found" }
  | { readonly type: "revision_conflict"; readonly expectedRevision: number; readonly actualRevision: number }
  | { readonly type: "version_immutable"; readonly status: FormVersionStatus }
  | { readonly type: "max_version_exceeded"; readonly max: number };

export interface CloneVersionOptions {
  readonly maxVersions?: number;
}

export interface PublishDraftOptions {
  readonly expectedRevision?: number;
  readonly validate?: (schema: FormSchema) => boolean;
  /** Supplies deterministic record timestamps while keeping the transition pure. */
  readonly timestamp?: string;
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

export function cloneVersionToDraft(
  state: FormVersionState,
  sourceSchema: FormSchema,
  options: CloneVersionOptions = {}
): Result<{ readonly nextState: FormVersionState; readonly draftSchema: FormSchema }, VersionTransitionError> {
  validateState(state);
  if (sourceSchema.id !== state.formId) throw new TypeError("sourceSchema.id must match state.formId.");
  if (state.draftVersion !== undefined) {
    return { success: false, error: { type: "draft_already_exists", currentDraftVersion: state.draftVersion } };
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

export function publishDraft(
  state: FormVersionState,
  draftSchema: FormSchema,
  options: PublishDraftOptions = {}
): Result<
  {
    readonly nextState: FormVersionState;
    readonly publishedRecord: FormVersionRecord;
    readonly archivedVersion?: number;
  },
  VersionTransitionError
> {
  validateState(state);
  if (options.expectedRevision !== undefined && options.expectedRevision !== state.revision) {
    return {
      success: false,
      error: {
        type: "revision_conflict",
        expectedRevision: options.expectedRevision,
        actualRevision: state.revision
      }
    };
  }
  if (
    state.draftVersion === undefined ||
    draftSchema.id !== state.formId ||
    draftSchema.version !== state.draftVersion
  ) {
    return { success: false, error: { type: "draft_not_found" } };
  }
  if (options.validate?.(draftSchema) === false) throw new TypeError("Draft schema validation failed.");
  const timestamp = options.timestamp ?? "1970-01-01T00:00:00.000Z";
  if (!Number.isFinite(Date.parse(timestamp))) throw new TypeError("timestamp must be a valid date string.");
  const archivedVersion = state.publishedVersion;
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
        createdAt: timestamp,
        publishedAt: timestamp
      },
      ...(archivedVersion === undefined ? {} : { archivedVersion })
    }
  };
}

export function deleteDraft(
  state: FormVersionState
): Result<{ readonly nextState: FormVersionState }, VersionTransitionError> {
  validateState(state);
  if (state.draftVersion === undefined) return { success: false, error: { type: "draft_not_found" } };
  const { draftVersion: _draftVersion, ...stateWithoutDraft } = state;
  return {
    success: true,
    value: { nextState: { ...stateWithoutDraft, revision: state.revision + 1 } }
  };
}

export function assertVersionMutable(status: FormVersionStatus): void {
  if (status !== "draft") {
    const error: VersionTransitionError = { type: "version_immutable", status };
    throw new TypeError(`A ${status} form version is immutable.`, { cause: error });
  }
}
