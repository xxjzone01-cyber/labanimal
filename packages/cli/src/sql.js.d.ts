declare module 'sql.js' {
  interface SqlJsStatic {
    Database: typeof Database;
  }

  interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    exec(sql: string): QueryExecResult[];
    run(sql: string, params?: unknown[]): Database;
    close(): void;
    export(): Uint8Array;
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
  export { Database, QueryExecResult, SqlJsStatic };
}
