export type FormResourceKind = "schema" | "version" | "state" | "submission" | "auditEvent" | "internal";
export type FormDeletionCounts = Readonly<Record<FormResourceKind, number>>;
export interface FormDeletionScope {
  readonly tenantId?: string;
  readonly ownerId?: string;
}
export interface FormDeletionRequest extends FormDeletionScope {
  readonly formId: string;
  readonly allowNonAtomic?: boolean;
  readonly dryRun?: boolean;
  readonly pageSize?: number;
  readonly cursor?: string;
}
export interface FormResource {
  readonly kind: FormResourceKind;
  readonly id: string;
  readonly value: unknown;
}
export interface FormLifecycleOptions {
  /** Map each stored resource (including internal records) to its actual scope. */
  readonly scope?: (resource: FormResource) => FormDeletionScope;
}
export interface FormDeletionInspection {
  readonly counts: FormDeletionCounts;
  readonly targets: readonly Pick<FormResource, "kind" | "id">[];
  readonly nextCursor?: string;
}
export interface FormDeletionResult {
  readonly status: "deleted" | "dry_run" | "partial" | "failed";
  readonly atomic: boolean;
  readonly counts: FormDeletionCounts;
  readonly inspection?: FormDeletionInspection;
  readonly error?: { readonly code: "transaction_unsupported" | "storage_error"; readonly cause?: unknown };
}
export interface FormLifecycleAdapter {
  readonly lifecycleCapabilities: {
    readonly resources: readonly FormResourceKind[];
    readonly atomic: boolean;
  };
  inspectFormDeletion(request: FormDeletionRequest): Promise<FormDeletionInspection>;
  deleteForm(request: FormDeletionRequest): Promise<FormDeletionResult>;
}
export interface FormLifecycleBackend {
  readonly resources: readonly FormResourceKind[];
  readonly list: (formId: string) => Promise<readonly FormResource[]>;
  /** Must condition deletion on the enumerated identity/value and return the actual affected count. */
  readonly remove: (resource: FormResource) => Promise<number>;
  /** Supplies an isolated backend bound to the transaction; rejection rolls back every removal. */
  readonly transaction?: <T>(operation: (backend: FormLifecycleBackend) => Promise<T>) => Promise<T>;
}

export function emptyFormDeletionCounts(): Record<FormResourceKind, number> {
  return { schema: 0, version: 0, state: 0, submission: 0, auditEvent: 0, internal: 0 };
}

export function createFormLifecycleAdapter(
  backend: FormLifecycleBackend,
  options: FormLifecycleOptions = {}
): FormLifecycleAdapter {
  function check(request: FormDeletionRequest): void {
    for (const value of [request.formId, request.tenantId, request.ownerId]) {
      if (value !== undefined && (typeof value !== "string" || value.trim().length === 0))
        throw new TypeError("Form and scope IDs must be non-empty strings.");
    }
    if ((request.tenantId !== undefined || request.ownerId !== undefined) && options.scope === undefined)
      throw new TypeError("Scoped deletion requires an adapter scope mapping.");
    if (
      request.pageSize !== undefined &&
      (!Number.isSafeInteger(request.pageSize) || request.pageSize < 1 || request.pageSize > 1000)
    )
      throw new RangeError("Deletion pageSize must be between 1 and 1000.");
  }
  async function targets(storage: FormLifecycleBackend, request: FormDeletionRequest) {
    const records = await storage.list(request.formId);
    return records
      .filter((resource) => {
        if (request.tenantId === undefined && request.ownerId === undefined) return true;
        const scope = options.scope?.(resource);
        if (scope === undefined) throw new TypeError("Scoped deletion mapping is unavailable for a resource.");
        if (request.tenantId !== undefined && scope.tenantId === undefined)
          throw new TypeError("Scoped deletion tenant mapping is unavailable for a resource.");
        if (request.ownerId !== undefined && scope.ownerId === undefined)
          throw new TypeError("Scoped deletion owner mapping is unavailable for a resource.");
        return (
          (request.tenantId === undefined || scope.tenantId === request.tenantId) &&
          (request.ownerId === undefined || scope.ownerId === request.ownerId)
        );
      })
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  }
  async function inspectFormDeletion(request: FormDeletionRequest): Promise<FormDeletionInspection> {
    check(request);
    const records = await targets(backend, request);
    const identity = JSON.stringify([request.formId, request.tenantId ?? null, request.ownerId ?? null]);
    let offset = 0;
    if (request.cursor !== undefined) {
      let decoded: unknown;
      try {
        decoded = JSON.parse(decodeURIComponent(request.cursor));
      } catch {
        throw new TypeError("Invalid deletion cursor.");
      }
      if (
        !Array.isArray(decoded) ||
        decoded.length !== 2 ||
        decoded[0] !== identity ||
        !Number.isSafeInteger(decoded[1]) ||
        decoded[1] < 0
      )
        throw new TypeError("Invalid deletion cursor.");
      offset = decoded[1];
    }
    const pageSize = request.pageSize ?? 100;
    const counts = emptyFormDeletionCounts();
    for (const record of records) counts[record.kind]++;
    return {
      counts,
      targets: records.slice(offset, offset + pageSize).map(({ kind, id }) => ({ kind, id })),
      ...(offset + pageSize >= records.length
        ? {}
        : { nextCursor: encodeURIComponent(JSON.stringify([identity, offset + pageSize])) })
    };
  }
  return {
    lifecycleCapabilities: { resources: backend.resources, atomic: backend.transaction !== undefined },
    inspectFormDeletion,
    async deleteForm(request) {
      check(request);
      if (request.cursor !== undefined) throw new TypeError("deleteForm does not accept a page cursor.");
      if (request.dryRun === true) {
        const inspection = await inspectFormDeletion(request);
        return { status: "dry_run", atomic: false, counts: emptyFormDeletionCounts(), inspection };
      }
      if (backend.transaction === undefined && request.allowNonAtomic !== true)
        return {
          status: "failed",
          atomic: false,
          counts: emptyFormDeletionCounts(),
          error: { code: "transaction_unsupported" }
        };
      let counts = emptyFormDeletionCounts();
      const atomic = backend.transaction !== undefined;
      const remove = async (storage: FormLifecycleBackend) => {
        // Transaction callbacks may be retried by the driver.
        counts = emptyFormDeletionCounts();
        for (const resource of await targets(storage, request)) {
          const count = await storage.remove(resource);
          if (!Number.isSafeInteger(count) || count < 0) throw new TypeError("Invalid deletion count.");
          counts[resource.kind] += count;
        }
      };
      try {
        if (backend.transaction === undefined) await remove(backend);
        else await backend.transaction(remove);
        return { status: "deleted", atomic, counts };
      } catch (cause) {
        if (atomic) counts = emptyFormDeletionCounts();
        return {
          status: Object.values(counts).some((count) => count > 0) ? "partial" : "failed",
          atomic,
          counts,
          error: { code: "storage_error", cause }
        };
      }
    }
  };
}
