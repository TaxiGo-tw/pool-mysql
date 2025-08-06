import Connection from './Connection'
import Types = require('./Schema/Types')

/** Helper type allowing various WHERE clause flavours */
export type WhereClause =
  | string
  | Record<string, any>
  | [string, any]
  | [string, any[]]

export interface StreamOptions {
  connection?: Connection
  highWaterMark?: number
  onValue?: (value: any, done?: () => void) => void | Promise<void>
  onEnd?: (err?: any) => void | Promise<void>
}

/**
 * Generic Schema base class. Concrete tables should `extends` this class to
 * describe their columns.
 */
declare class Schema<T extends Record<string, any> = any> {
  /** Construct a model instance from DB row data */
  constructor(dict?: Partial<T>)

  // ──────────────────────────────── Static helpers ──
  static SELECT<T = any>(...columns: (keyof T | string)[]): Schema<T>
  static INSERT<T = any>(ignore?: boolean): Schema<T>
  static UPDATE<T = any>(table?: string): Schema<T>
  static DELETE<T = any>(): Schema<T>
  static FIND<T = any>(...whereClause: any[]): Schema<T>
  static FIND_PK<T = any>(pk: any): Schema<T>
  static readonly KEYS: string[]
  static readonly Types: typeof Types
  readonly Types: typeof Types

  // ─────────────────────────────── Query builder ──
  SELECT(columns?: (keyof T | string)[]): this
  FROM(table?: string): this
  JOIN(on: string, values?: any): this
  LEFTJOIN(on: string, values?: any): this
  WHERE(where: WhereClause, value?: any): this
  AND(where: WhereClause, value?: any): this
  OR(where: WhereClause, value?: any): this
  HAVING(...columns: string[]): this
  GROUP_BY(...columns: string[]): this
  ORDER_BY(column: string, sort?: 'ASC' | 'DESC'): this
  LIMIT(limit?: number, defaultValue?: number): this
  OFFSET(offset?: number, defaultValue?: number): this
  INSERT(ignore?: boolean): this
  INTO(table?: string): this
  VALUES(values: any[][]): this
  UPDATE(table?: string): this
  SET(values: Record<string, any>, value?: any): this
  DUPLICATE(values: Record<string, any>, value?: any): this
  DELETE(): this
  FIRST(): this
  FILTER(cb: (row: T) => boolean): this
  POPULATE(...fields: string[]): this
  MAP<U = any>(cb: (row: T) => U): this
  REDUCE<U = any>(cb: (acc: U, curr: T) => U, initVal?: U): this
  NESTED(): this
  EX(expireSecond: number, options?: {
    key?: string
    forceUpdate?: boolean
    shouldRefreshInCache?: (cached: any) => boolean
  }): this
  ENCRYPT(...columns: (keyof T | string)[]): this
  DECRYPT(...columns: (keyof T | string)[]): this
  COMBINE(): this
  UPDATED(...variables: string[]): this
  CHANGED_ROWS(rows: number): this
  AFFECTED_ROWS(rows: number): this
  PRINT(flag?: boolean): this
  WRITER(useWriter?: boolean): this
  ON_ERR(cb: ((err: any) => any) | string): this
  NESTTABLES(): this

  // ─────────────────────────────── Execution ──
  exec<R = any>(connection?: Connection, options?: any): Promise<R>
  rollback(connection?: Connection): Promise<any>
  stream(opts: StreamOptions): Promise<void>

  // ─────────────────────────────── Validation ──
  validate(isInsert?: boolean): boolean

  // save current instance (UPDATE) helper
  save(): Promise<void>

  // internal: primary key field name
  protected readonly _pk: string
}

export default Schema;
