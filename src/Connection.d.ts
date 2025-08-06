export default class Connection {
  constructor(pool: any);

  /**
   * Lazily acquires underlying MySQL connections.
   * @param type Which connections to acquire. Defaults to `'All'`.
   * @returns Promise resolving to the current `Connection` instance so calls can be chained.
   */
  connect(type?: 'All' | 'Writer' | 'Reader'): Promise<this>;

  /**
   * Starts a transaction on the writer connection.
   */
  beginTransaction(cb?: (error?: Error) => void): Promise<void>;

  /** @deprecated Alias of `beginTransaction` kept for backward-compat. */
  awaitTransaction(): Promise<void>;

  /**
   * Legacy callback-style query method.
   */
  query(
    sql: string | { sql: string; nestTables?: any },
    values?: any[] | Record<string, any>,
    callback?: (error: Error | null, results: any) => void,
  ): void;

  /**
   * Preferred Promise-based query helper.
   */
  q(
    sql: string | { sql: string; nestTables?: any },
    values?: any[] | Record<string, any>,
    options?: {
      key?: string;
      EX?: number;
      shouldRefreshInCache?: (cached: any) => boolean;
      redisPrint?: boolean;
      combine?: boolean;
    },
  ): Promise<any>;

  /**
   * Commit the current transaction (callback style).
   */
  commit(cb?: (error: Error | null, result: any) => void): void;

  /** Commit the current transaction (Promise style). */
  commitAsync(): Promise<void>;

  /** @deprecated Alias of `commitAsync`. */
  awaitCommit(): Promise<void>;

  /** Rollback the current transaction. */
  rollback(): Promise<void>;

  /** Release underlying driver connections back to their pools. */
  release(): void;

  /** Close underlying driver connections and destroy references. */
  end(): void;

  /** Force queries issued after this call to use the writer connection. */
  readonly forceWriter: this;

  /** Log query even if it isn't considered a long query. */
  readonly print: this;

  /** Ensure that exactly one row is affected by UPDATE / DELETE. */
  readonly mustUpdateOneRow: this;

  /** Supply a custom error mapper or message. */
  onErr(callbackOrString: ((error: any) => string) | string): this;
}
