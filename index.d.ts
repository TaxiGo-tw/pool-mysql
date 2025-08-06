declare namespace poolMysql {
  export type Connection = import('./src/Connection').default
  export type Schema = typeof import('./src/Schema').default
  export interface Pool {
    connection(opts?: { priority?: number; limit?: number }): Connection
    /** @deprecated use connection() */
    createConnection(opts?: { limit?: number }): Promise<Connection>
    Schema: Schema
  }
} 
declare const poolMysql: poolMysql.Pool
export = poolMysql