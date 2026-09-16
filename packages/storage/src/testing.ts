import {
  createCloneTransitionPlan,
  createInitialSchemaByMode,
  decodeSubmissionCursor,
  encodeSubmissionCursor,
  exportResponsesToCsv,
  type FormLifecycleAdapter,
  type FormResource,
  type FormSchema,
  type FormStorageAdapter,
  type FormSubmission,
  type FormVersionState,
  type PagedSubmissionStorageAdapter,
  type SubmissionSaveResult,
  type VersionedFormStorageAdapter
} from "@form-engine-ts/core";

/** Fresh JSON fixtures: callers may customize a copy without contaminating another adapter's run. */
export function createStorageContractFixtures() {
  const schema: FormSchema = {
    ...createInitialSchemaByMode("poll", { id: "contract-form", title: "Contract", locale: "en" }),
    supportedLocales: ["en", "ja"],
    metadata: { mode: "poll", tenantId: "tenant-a", ownerId: "owner-a", custom: { nested: [true, 2, "three"] } },
    translationMetadata: { ja: { title: { provider: "fixture", translationSource: "manual", custom: "retained" } } }
  };
  const submissions: readonly FormSubmission[] = ["a", "b", "c"].map((id) => ({
    id: `contract-${id}`,
    formId: schema.id,
    formVersion: schema.version,
    locale: id === "c" ? "ja" : "en",
    submittedAt: "2026-01-01T00:00:00.000Z",
    values: { "question-1": "option-1" },
    metadata: { tenantId: "tenant-a", ownerId: "owner-a", custom: { source: id } },
    translationMetadata: { ja: { "question-1": { provider: "fixture", translationSource: "manual" } } }
  }));
  const state: FormVersionState = { formId: schema.id, nextVersion: 2, revision: 0, publishedVersion: 1 };
  return {
    schema,
    submissions,
    state,
    revisionConflict: { expectedRevision: 1, actualRevision: 0 },
    cursor: { submittedAt: "2026-01-01T00:00:00.000Z", responseId: "contract-a" },
    invalidCursors: ["not-a-cursor", "%", "{}"],
    csv: {
      options: { withBom: false },
      expected:
        "submissionId,submittedAt,locale,question-1\r\ncontract-a,2026-01-01T00:00:00.000Z,en,option-1\r\ncontract-b,2026-01-01T00:00:00.000Z,en,option-1\r\ncontract-c,2026-01-01T00:00:00.000Z,ja,option-1"
    }
  };
}

export function storageContractScope(resource: FormResource): { tenantId?: string; ownerId?: string } {
  const value = resource.value;
  if (typeof value !== "object" || value === null || !("metadata" in value)) return {};
  const metadata = value.metadata;
  if (typeof metadata !== "object" || metadata === null) return {};
  return {
    ...("tenantId" in metadata && typeof metadata.tenantId === "string" ? { tenantId: metadata.tenantId } : {}),
    ...("ownerId" in metadata && typeof metadata.ownerId === "string" ? { ownerId: metadata.ownerId } : {})
  };
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Storage contract: ${message}`);
}

export interface StorageContractReport {
  readonly passed: readonly string[];
  readonly unsupported: readonly string[];
}

/** Run against an empty, disposable adapter. Never clears a caller's database. */
export async function runStorageContract(adapter: FormStorageAdapter): Promise<StorageContractReport> {
  const { schema, submissions } = createStorageContractFixtures();
  await adapter.saveSchema(schema);
  const stored = await adapter.getSchema(schema.id, schema.version);
  check(JSON.stringify(stored) === JSON.stringify(schema), "schema JSON/translation metadata round trip");
  for (const submission of submissions) await adapter.saveSubmission(submission);
  const loaded = await adapter.listSubmissions(schema.id, schema.version);
  check(JSON.stringify(loaded) === JSON.stringify(submissions), "submission ordering/metadata round trip");
  const passed = ["schema", "submission", "translation_metadata"];
  const unsupported: string[] = [];
  if ("listSubmissionPage" in adapter && typeof adapter.listSubmissionPage === "function") {
    const paged = adapter as PagedSubmissionStorageAdapter;
    const ids: string[] = [];
    let cursor: string | undefined;
    for (let index = 0; index < 10; index++) {
      const page = await paged.listSubmissionPage(schema.id, {
        pageSize: 1,
        ...(cursor === undefined ? {} : { cursor })
      });
      ids.push(...page.items.map((item) => item.id));
      if (!page.hasMore) break;
      check(page.nextCursor !== undefined && page.nextCursor !== cursor, "pagination must make progress");
      cursor = page.nextCursor;
    }
    check(
      JSON.stringify(ids) === JSON.stringify(submissions.map((item) => item.id)),
      "pagination must not lose or repeat records"
    );
    passed.push("pagination");
  } else unsupported.push("pagination");
  return { passed, unsupported };
}

export async function runIdempotencyContract(
  save: (submission: FormSubmission) => Promise<undefined | SubmissionSaveResult>
): Promise<void> {
  const [submission] = createStorageContractFixtures().submissions;
  if (submission === undefined) throw new Error("Missing fixture");
  check((await save(submission))?.status === "created", "first idempotent save");
  check((await save(submission))?.status === "duplicate", "retry must be a duplicate");
  check(
    (await save({ ...submission, values: { "question-1": "option-2" } }))?.status === "conflict",
    "changed payload must conflict"
  );
}

export async function runRevisionConflictContract(adapter: VersionedFormStorageAdapter): Promise<void> {
  const { schema, state } = createStorageContractFixtures();
  const planned = createCloneTransitionPlan(
    state,
    { formId: schema.id, version: 1, status: "published", schema, revision: 1, createdAt: "2026-01-01T00:00:00.000Z" },
    { expectedRevision: 0, clonedAt: "2026-01-01T00:00:00.000Z" }
  );
  check(planned.success, "valid transition fixture");
  const first = await adapter.commitVersionTransition(planned.value.plan);
  check(first.success, "first transition commits");
  const retry = await adapter.commitVersionTransition(planned.value.plan);
  check(!retry.success && retry.error.type === "revision_conflict", "stale transition conflicts");
}

export async function runLifecycleContract(adapter: FormStorageAdapter): Promise<void> {
  if (
    adapter.inspectFormDeletion === undefined ||
    adapter.deleteForm === undefined ||
    adapter.lifecycleCapabilities === undefined
  )
    throw new Error("Adapter does not expose the lifecycle contract.");
  const lifecycle = adapter as FormStorageAdapter & FormLifecycleAdapter;
  const { schema, submissions } = createStorageContractFixtures();
  const submission = submissions[0];
  if (submission === undefined) throw new Error("Missing fixture");
  await adapter.saveSchema(schema);
  await adapter.saveSubmission(submission);
  await adapter.saveSchema({ ...schema, id: "contract-other" });
  await adapter.saveSchema({ ...schema, version: 2, metadata: { tenantId: "tenant-b", ownerId: "owner-a" } });
  await adapter.saveSchema({ ...schema, version: 3, metadata: { tenantId: "tenant-a", ownerId: "owner-b" } });
  const request = { formId: schema.id, tenantId: "tenant-a", ownerId: "owner-a" };
  const inspection = await lifecycle.inspectFormDeletion({ ...request, pageSize: 1 });
  check(inspection.counts.schema === 1 && inspection.counts.submission === 1, "scope inspection counts");
  check(inspection.targets.length === 1 && inspection.nextCursor !== undefined, "inspection pagination");
  const next = await lifecycle.inspectFormDeletion({ ...request, pageSize: 1, cursor: inspection.nextCursor });
  check(next.targets.length === 1 && next.targets[0]?.id !== inspection.targets[0]?.id, "inspection next page");
  check((await lifecycle.deleteForm({ ...request, dryRun: true })).status === "dry_run", "dry run result");
  check((await adapter.listSubmissions(schema.id)).length === 1, "dry run must not mutate");
  if (!lifecycle.lifecycleCapabilities.atomic) {
    check(
      (await lifecycle.deleteForm(request)).error?.code === "transaction_unsupported",
      "atomic default rejects unsupported storage"
    );
    check((await adapter.listSubmissions(schema.id)).length === 1, "unsupported transaction must not mutate");
  }
  const result = await lifecycle.deleteForm({ ...request, allowNonAtomic: true });
  check(
    result.status === "deleted" && result.counts.schema === 1 && result.counts.submission === 1,
    "actual deletion counts"
  );
  check((await adapter.getSchema("contract-other", 1)) !== null, "other form survives");
  check((await adapter.getSchema(schema.id, 2)) !== null, "other tenant survives");
  check((await adapter.getSchema(schema.id, 3)) !== null, "other owner survives");
  const retry = await lifecycle.deleteForm({ ...request, allowNonAtomic: true });
  check(
    retry.status === "deleted" && Object.values(retry.counts).every((count) => count === 0),
    "deletion retry is empty"
  );
}

export function verifyStorageCodecVectors(): void {
  const fixtures = createStorageContractFixtures();
  check(
    JSON.stringify(decodeSubmissionCursor(encodeSubmissionCursor(fixtures.cursor))) === JSON.stringify(fixtures.cursor),
    "cursor round trip"
  );
  for (const cursor of fixtures.invalidCursors) {
    let rejected = false;
    try {
      decodeSubmissionCursor(cursor);
    } catch {
      rejected = true;
    }
    check(rejected, "invalid cursor rejection");
  }
  check(
    exportResponsesToCsv(fixtures.schema, fixtures.submissions, fixtures.csv.options) === fixtures.csv.expected,
    "CSV fixture output"
  );
}
