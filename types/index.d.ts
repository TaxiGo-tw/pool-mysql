declare namespace poolMysql {
  export type Connection = import('./Connection')
  export type Schema = typeof import('./Schema')
  export type Encryption = typeof import('./Schema/Encryption')
  export interface Pool {
    connection(opts?: { priority?: number; limit?: number }): Connection
    /** @deprecated use connection() */
    createConnection(opts?: { limit?: number }): Promise<Connection>
    Schema: Schema
    Encryption: Encryption
  }
} 
declare const poolMysql: poolMysql.Pool
export = poolMysql