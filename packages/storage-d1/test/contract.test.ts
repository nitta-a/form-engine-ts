import { runLifecycleContract, runStorageContract, storageContractScope } from "@form-engine-ts/storage/testing";
import { createContractSqlDatabase } from "../../../scripts/storage-contract-sql";
import { createD1Storage, type D1DatabaseLike, type D1PreparedStatementLike } from "../src";

function fixture() {
  const { database, execute } = createContractSqlDatabase();
  const prepare = (sql: string, params: readonly unknown[] = []): D1PreparedStatementLike => ({
    bind: (...values) => prepare(sql, values),
    first: async <T>() => (execute(sql, params)[0] as T | null) ?? null,
    all: async <T>() => ({ success: true, results: execute(sql, params) as T[] }),
    run: async <T>() => ({ success: true, results: execute(sql, params) as T[] })
  });
  const db: D1DatabaseLike = {
    prepare,
    batch: async (statements) => Promise.all(statements.map((statement) => statement.run()))
  };
  return { database, adapter: createD1Storage({ db, autoMigrate: true, lifecycle: { scope: storageContractScope } }) };
}
it("passes shared JSON and non-atomic lifecycle vectors", async () => {
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
