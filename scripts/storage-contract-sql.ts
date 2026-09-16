type SQLInputValue = string | number | bigint | null;
interface SqliteStatement {
  columns(): readonly unknown[];
  run(...params: SQLInputValue[]): unknown;
  all(...params: SQLInputValue[]): readonly Record<string, unknown>[];
}
interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  close(): void;
}
const sqliteModuleName = "node:sqlite";
const { DatabaseSync } = (await import(sqliteModuleName)) as {
  readonly DatabaseSync: new (filename: string) => SqliteDatabase;
};

/** In-process SQL harness. PostgreSQL-specific syntax is still checked by its SQL assertion tests. */
export function createContractSqlDatabase() {
  const database = new DatabaseSync(":memory:");
  function input(value: unknown): SQLInputValue {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "bigint")
      return value;
    if (value instanceof Date) return value.toISOString();
    throw new TypeError("Unsupported SQL fixture parameter.");
  }
  const execute = (sql: string, params: readonly unknown[] = []) => {
    if (params.length === 0 && sql.includes(";") && !/\bRETURNING\b/i.test(sql)) {
      database.exec(sql.replace(/::(?:jsonb|timestamptz)/g, ""));
      return [];
    }
    const numbered = /\$\d+/.test(sql);
    const bindings: SQLInputValue[] = numbered ? [] : params.map(input);
    const normalized = sql.replace(/::(?:jsonb|timestamptz)/g, "").replace(/\$(\d+)/g, (_match, index: string) => {
      bindings.push(input(params[Number(index) - 1]));
      return "?";
    });
    const statement = database.prepare(normalized);
    let rows: readonly Record<string, unknown>[];
    if (statement.columns().length === 0) {
      statement.run(...bindings);
      rows = [];
    } else {
      rows = statement.all(...bindings);
    }
    return rows.map((row: Record<string, unknown>) => ({ ...row }));
  };
  return { database, execute };
}
