import { runLifecycleContract, runStorageContract, storageContractScope } from "@form-engine-ts/storage/testing";
import { createContractSqlDatabase } from "../../../scripts/storage-contract-sql";
import { createSqliteStorage, type SqliteExecutor } from "../src";

function fixture() {
  const { database, execute } = createContractSqlDatabase();
  const db: SqliteExecutor = {
    run: (sql, params) => {
      execute(sql, params);
    },
    get: <T>(sql: string, params?: readonly unknown[]) => execute(sql, params)[0] as T | undefined,
    all: <T>(sql: string, params?: readonly unknown[]) => execute(sql, params) as unknown as readonly T[],
    async transaction(operation) {
      database.exec("BEGIN");
      try {
        const result = await operation(db);
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
    adapter: createSqliteStorage({ db, autoMigrate: true, lifecycle: { scope: storageContractScope } })
  };
}
it("passes shared JSON and lifecycle vectors using SQLite", async () => {
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
