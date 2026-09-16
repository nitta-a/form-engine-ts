import { runLifecycleContract, runStorageContract, storageContractScope } from "@form-engine-ts/storage/testing";
import { createContractSqlDatabase } from "../../../scripts/storage-contract-sql";
import { createPostgresStorage, type PostgresClientLike } from "../src";

function fixture() {
  const { database, execute } = createContractSqlDatabase();
  const client: PostgresClientLike = {
    query: async (sql, params) => ({ rows: execute(sql, params) }),
    async transaction(operation) {
      database.exec("BEGIN");
      try {
        const result = await operation(client);
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
  };
  return {
    database,
    client,
    adapter: createPostgresStorage({ client, autoMigrate: true, lifecycle: { scope: storageContractScope } })
  };
}
it("passes shared JSON, pagination and lifecycle vectors", async () => {
  const first = fixture();
  try {
    await runStorageContract(first.adapter);
  } finally {
    first.database.close();
  }
  const second = fixture();
  try {
    await runLifecycleContract(second.adapter);
  } finally {
    second.database.close();
  }
});
it("rolls back deletion when a later statement fails", async () => {
  const { database, client, adapter } = fixture();
  try {
    await adapter.saveSchema({
      id: "rollback",
      version: 1,
      title: "Rollback",
      fields: [{ id: "q", type: "text", title: "Q", required: false }]
    });
    await adapter.saveSubmission({
      id: "response",
      formId: "rollback",
      formVersion: 1,
      locale: "en",
      submittedAt: "2026-01-01T00:00:00.000Z",
      values: {}
    });
    const query = client.query;
    client.query = async (sql, params) => {
      if (sql.startsWith("DELETE") && sql.includes('"form_responses"')) throw new Error("injected");
      return query(sql, params);
    };
    if (adapter.deleteForm === undefined) throw new Error("Postgres lifecycle contract is unavailable");
    const deleteForm = adapter.deleteForm;
    const result = await deleteForm({ formId: "rollback" });
    expect(result).toMatchObject({ status: "failed", atomic: true, counts: { schema: 0, submission: 0 } });
    expect(await adapter.getSchema("rollback", 1)).not.toBeNull();
  } finally {
    database.close();
  }
});
