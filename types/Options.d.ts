declare function _exports(options: {}, poolID: any): {
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
export = _exports;
