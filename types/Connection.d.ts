export = Connection;
declare class Connection {
    /**
   * @param {Pool} pool
   */
    constructor(pool: Pool);
    _pool: {
        createPool({ options: op, redisClient }: {
            options?: {};
            redisClient: any;
        }): any;
        id: any;
        options: {
            writer: any;
            reader: any;
            poolID: any;
            SQL_FREE_CONNECTIONS: string | number;
            QUERY_THRESHOLD_START: string | number;
            QUERY_THRESHOLD_MS: string | number;
            DATA_ENCRYPTION_KEY: string;
            DATA_ENCRYPTION_IV: string;
            REDIS_HOST: string;
            REDIS_PORT: string;
            connectionLimit: string | number;
            maxRequesting: string | number;
            forceWriter: boolean;
        };
        _mysqlConnectionManager: import("./MySQLConnectionManager");
        get redisClient(): any;
        set redisClient(newValue: any);
        Schema: typeof import("./Schema");
        _pools: {};
        combine: import("./Schema/Combine");
        identity(): string;
        get event(): import("events")<[never]>;
        get Encryption(): {
            new (): import("./Schema/Encryption");
            buffered({ key, iv }: {
                key: any;
                iv: any;
            }): {
                key: Buffer<ArrayBuffer>;
                iv: Buffer<ArrayBuffer>;
            };
            encrypt(text: any, secret?: {
                key: string;
                iv: string;
            }): string;
            decrypt(text: any, secret?: {
                key: string;
                iv: string;
            }): string;
        };
        get logger(): (toPrint: any) => void;
        set logger(string: (toPrint: any) => void);
        _redisClient: any;
        get mockable(): boolean;
        get mock(): any;
        set mock(callback: any);
        _mockCounter: number;
        _mock: any;
        getConnection(cb: any): void;
        createConnection({ limit }?: {
            limit?: string | number;
        }): Promise<import("./Connection")>;
        connection({ priority, limit }?: {
            priority?: number;
            limit?: string | number;
        }): import("./Connection");
        query(sql: any, b: any, c: any): {};
        release(): void;
    };
    gotAt: Date;
    randomID: string;
    identity(mysqlConnection: any): string;
    resetStatus(): void;
    _status: {
        useWriter: boolean;
        print: boolean;
        mustUpdateOneRow: boolean;
        onErr: any;
    };
    genWriter(): Promise<any>;
    writer: any;
    genReader(): Promise<any>;
    reader: any;
    /**
   * Lazily acquires underlying MySQL connections.
   * @param {'All' | 'Writer' | 'Reader'} [type='All'] Which connections to acquire. Defaults to `'All'`.
   * @returns {Promise<this>} Promise resolving to the current `Connection` instance so calls can be chained.
   */
    connect(type?: "All" | "Writer" | "Reader"): Promise<this>;
    /**
   * @deprecated use `beginTransaction` for naming style
   * @returns {Promise<void>}
   */
    awaitTransaction(): Promise<void>;
    /**
   * Starts a transaction on the writer connection.
   * @param {(error?: Error) => void} [cb]
   * @returns {Promise<void>}
   */
    beginTransaction(cb?: (error?: Error) => void): Promise<void>;
    /**
   * @deprecated use `q()` for async/await
   * Legacy callback-style query method.
   * @param {string | { sql: string; nestTables?: any }} sql
   * @param {any[] | Record<string, any>} [values]
   * @param {(error: Error | null, results: any) => void} [cb]
   */
    query(sql: string | {
        sql: string;
        nestTables?: any;
    }, bb: any, cc: any): void;
    _q(sql: any, values: any): Promise<any>;
    _queryMode({ EX, combine, queryKey }?: {}): {
        Normal: boolean;
        CombineSubscriber?: undefined;
        CombineLeader?: undefined;
        Caching?: undefined;
    } | {
        CombineSubscriber: boolean;
        Normal?: undefined;
        CombineLeader?: undefined;
        Caching?: undefined;
    } | {
        CombineLeader: boolean;
        Normal?: undefined;
        CombineSubscriber?: undefined;
        Caching?: undefined;
    } | {
        Caching: boolean;
        Normal?: undefined;
        CombineSubscriber?: undefined;
        CombineLeader?: undefined;
    };
    /**
   * Preferred Promise-based query helper.
   * @param {string | { sql: string; nestTables?: any }} sql
   * @param {any[] | Record<string, any>} [values]
   * @param {{key?: string; EX?: number; shouldRefreshInCache?: (cached: any) => boolean; redisPrint?: boolean; combine?: boolean}} [options]
   * @returns {Promise<any>}
   */
    q(sql: string | {
        sql: string;
        nestTables?: any;
    }, values?: any[] | Record<string, any>, { key, EX, shouldRefreshInCache, redisPrint, combine }?: {
        key?: string;
        EX?: number;
        shouldRefreshInCache?: (cached: any) => boolean;
        redisPrint?: boolean;
        combine?: boolean;
    }): Promise<any>;
    /**
   * @deprecated use `commitAsync()` for async/await
   * Commit the current transaction (callback style).
   * @param {(error: Error | null, result: any) => void} [cb]
   */
    commit(cb?: (error: Error | null, result: any) => void): void;
    /**
   * @deprecated use `commitAsync()` for naming style
   * @returns {Promise<void>}
   */
    awaitCommit(): Promise<void>;
    /**
   * Commit the current transaction (Promise style).
   * @returns {Promise<void>}
   */
    commitAsync(): Promise<void>;
    /**
   * Rollback the current transaction.
   * @returns {Promise<void>}
   */
    rollback(): Promise<void>;
    /**
   * Release underlying driver connections back to their pools.
   */
    release(): void;
    /**
   * Close underlying driver connections and destroy references.
   */
    end(): void;
    /**
   * @param {string} sql
   * @returns {boolean}
   */
    isSelect(sql: string): boolean;
    _getReaderOrWriter(sql: any, useWriter: any): Promise<any>;
    /**
   * Force queries issued after this call to use the writer connection.
   * @returns {this}
   */
    get forceWriter(): this;
    /**
   * Log query even if it isn't considered a long query.
   * @returns {this}
   */
    get print(): this;
    /**
   * Ensure that exactly one row is affected by UPDATE / DELETE.
   * @returns {this}
   */
    get mustUpdateOneRow(): this;
    /**
   * Supply a custom error mapper or message.
   * @param {((error: any) => string) | string} callbackOrString
   * @returns {this}
   */
    onErr(callbackOrString: ((error: any) => string) | string): this;
}
declare namespace Connection {
    export { Pool };
}
type Pool = {
    createPool({ options: op, redisClient }: {
        options?: {};
        redisClient: any;
    }): any;
    id: any;
    options: {
        writer: any;
        reader: any;
        poolID: any;
        SQL_FREE_CONNECTIONS: string | number;
        QUERY_THRESHOLD_START: string | number;
        QUERY_THRESHOLD_MS: string | number;
        DATA_ENCRYPTION_KEY: string;
        DATA_ENCRYPTION_IV: string;
        REDIS_HOST: string;
        REDIS_PORT: string;
        connectionLimit: string | number;
        maxRequesting: string | number;
        forceWriter: boolean;
    };
    _mysqlConnectionManager: import("./MySQLConnectionManager");
    get redisClient(): any;
    set redisClient(newValue: any);
    Schema: typeof import("./Schema");
    _pools: {};
    combine: import("./Schema/Combine");
    identity(): string;
    get event(): import("events")<[never]>;
    get Encryption(): {
        new (): import("./Schema/Encryption");
        buffered({ key, iv }: {
            key: any;
            iv: any;
        }): {
            key: Buffer<ArrayBuffer>;
            iv: Buffer<ArrayBuffer>;
        };
        encrypt(text: any, secret?: {
            key: string;
            iv: string;
        }): string;
        decrypt(text: any, secret?: {
            key: string;
            iv: string;
        }): string;
    };
    get logger(): (toPrint: any) => void;
    set logger(string: (toPrint: any) => void);
    _redisClient: any;
    get mockable(): boolean;
    get mock(): any;
    set mock(callback: any);
    _mockCounter: number;
    _mock: any;
    getConnection(cb: any): void;
    createConnection({ limit }?: {
        limit?: string | number;
    }): Promise<import("./Connection")>;
    connection({ priority, limit }?: {
        priority?: number;
        limit?: string | number;
    }): import("./Connection");
    query(sql: any, b: any, c: any): {};
    release(): void;
};
