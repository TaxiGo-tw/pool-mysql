export = instance;
declare const instance: Pool;
declare class Pool {
    constructor({ options, redisClient, id }?: {});
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
    _mysqlConnectionManager: MySQLConnectionManager;
    set redisClient(newValue: any);
    get redisClient(): any;
    Schema: typeof import("./Schema");
    _pools: {};
    combine: Combine;
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
    set logger(string: (toPrint: any) => void);
    get logger(): (toPrint: any) => void;
    _redisClient: any;
    get mockable(): boolean;
    set mock(callback: any);
    get mock(): any;
    _mockCounter: number;
    _mock: any;
    /**
    * @deprecated use `connection()` for [Function]
    */
    getConnection(cb: any): void;
    /**
        * @deprecated use `connection()` for [Function]
        */
    createConnection({ limit }?: {
        limit?: string | number;
    }): Promise<Connection>;
    connection({ priority, limit }?: {
        priority?: number;
        limit?: string | number;
    }): Connection;
    /**
    * @deprecated use `connection()` for [Function]
    */
    query(sql: any, b: any, c: any): {};
    /**
    * @deprecated use `not really do anything`
    */
    release(): void;
}
import MySQLConnectionManager = require("./MySQLConnectionManager");
import Combine = require("./Schema/Combine");
import Connection = require("./Connection");
