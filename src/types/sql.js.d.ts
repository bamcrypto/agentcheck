declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string, params?: unknown[]): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  interface QueryExecResult {
    columns: string[];
    values: SqlValue[][];
  }

  type SqlValue = string | number | Uint8Array | null;

  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
  export { Database, QueryExecResult, SqlValue };
}
