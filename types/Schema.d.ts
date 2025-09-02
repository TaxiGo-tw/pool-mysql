export = Schema;
declare class Schema<T extends Record<string, any>> {
    static get _pool(): {
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
            new (): Encryption;
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
    /**
   * Execute raw SQL query
   * @param {Connection} [outSideConnection]
   * @param {string} sql
   * @param {any[]} [values]
   * @returns {Promise<any>}
   */
    static native(outSideConnection?: Connection, sql: string, values?: any[]): Promise<any>;
    /**
   * @returns {string[]}
   */
    static get KEYS(): string[];
    /**
   * @template {Record<string, any>} T
   * @param {...(keyof T | string)} columns
   * @returns {Schema<T>}
   */
    static SELECT<T_1 extends Record<string, any>>(...columns: (keyof T_1 | string)[]): Schema<T_1>;
    /**
   * @template {Record<string, any>} T
   * @param {boolean} [ignore]
   * @returns {Schema<T>}
   */
    static INSERT<T_1 extends Record<string, any>>(ignore?: boolean): Schema<T_1>;
    /**
   * @template {Record<string, any>} T
   * @returns {Schema<T>}
   */
    static DELETE<T_1 extends Record<string, any>>(): Schema<T_1>;
    static get columns(): any;
    /**
     * @returns {Types}
     */
    static get Types(): {
        Base: {
            new (): {};
            validate(value: any): boolean;
        };
        PK: {
            new (): {};
            validate(): boolean;
        };
        FK: (model: any, column: any) => {
            new (): {};
            get model(): any;
            get column(): any;
            get _refType(): any;
            validate(value: any): any;
            inputMapper(value: any): any;
        };
        Point: {
            new (): {};
            get regex(): RegExp;
            validate(value: any): boolean;
            inputMapper(value: any): any;
            rangeValidator({ x, y }: {
                x: any;
                y: any;
            }): boolean;
        };
        Polygon: {
            new (): {};
            _isObjectArray(arr: any): boolean;
            _isAllContentsHasValue(arr: any): boolean;
            validate(value: any): boolean;
            inputMapper(value: any): any;
        };
        ENUM: (...values: any[]) => {
            new (): {};
            get enum(): any[];
            validate(value: any): boolean;
        };
        Number: {
            new (value?: any): {
                toString(radix?: number): string;
                toFixed(fractionDigits?: number): string;
                toExponential(fractionDigits?: number): string;
                toPrecision(precision?: number): string;
                valueOf(): number;
                toLocaleString(locales?: string | string[], options?: Intl.NumberFormatOptions): string;
                toLocaleString(locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions): string;
            };
            validate(number: any): boolean;
            readonly MAX_VALUE: number;
            readonly MIN_VALUE: number;
            readonly NaN: number;
            readonly NEGATIVE_INFINITY: number;
            readonly POSITIVE_INFINITY: number;
            readonly EPSILON: number;
            isFinite(number: unknown): boolean;
            isInteger(number: unknown): boolean;
            isNaN(number: unknown): boolean;
            isSafeInteger(number: unknown): boolean;
            readonly MAX_SAFE_INTEGER: number;
            readonly MIN_SAFE_INTEGER: number;
            parseFloat(string: string): number;
            parseInt(string: string, radix?: number): number;
        };
        String: {
            new (value?: any): {
                readonly [index: number]: string;
                toString(): string;
                charAt(pos: number): string;
                charCodeAt(index: number): number;
                concat(...strings: string[]): string;
                indexOf(searchString: string, position?: number): number;
                lastIndexOf(searchString: string, position?: number): number;
                localeCompare(that: string): number;
                localeCompare(that: string, locales?: string | string[], options?: Intl.CollatorOptions): number;
                localeCompare(that: string, locales?: Intl.LocalesArgument, options?: Intl.CollatorOptions): number;
                match(regexp: string | RegExp): RegExpMatchArray | null;
                match(matcher: {
                    [Symbol.match](string: string): RegExpMatchArray | null;
                }): RegExpMatchArray | null;
                replace(searchValue: string | RegExp, replaceValue: string): string;
                replace(searchValue: string | RegExp, replacer: (substring: string, ...args: any[]) => string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replaceValue: string): string;
                }, replaceValue: string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replacer: (substring: string, ...args: any[]) => string): string;
                }, replacer: (substring: string, ...args: any[]) => string): string;
                search(regexp: string | RegExp): number;
                search(searcher: {
                    [Symbol.search](string: string): number;
                }): number;
                slice(start?: number, end?: number): string;
                split(separator: string | RegExp, limit?: number): string[];
                split(splitter: {
                    [Symbol.split](string: string, limit?: number): string[];
                }, limit?: number): string[];
                substring(start: number, end?: number): string;
                toLowerCase(): string;
                toLocaleLowerCase(locales?: string | string[]): string;
                toLocaleLowerCase(locales?: Intl.LocalesArgument): string;
                toUpperCase(): string;
                toLocaleUpperCase(locales?: string | string[]): string;
                toLocaleUpperCase(locales?: Intl.LocalesArgument): string;
                trim(): string;
                readonly length: number;
                substr(from: number, length?: number): string;
                valueOf(): string;
                codePointAt(pos: number): number | undefined;
                includes(searchString: string, position?: number): boolean;
                endsWith(searchString: string, endPosition?: number): boolean;
                normalize(form: "NFC" | "NFD" | "NFKC" | "NFKD"): string;
                normalize(form?: string): string;
                repeat(count: number): string;
                startsWith(searchString: string, position?: number): boolean;
                anchor(name: string): string;
                big(): string;
                blink(): string;
                bold(): string;
                fixed(): string;
                fontcolor(color: string): string;
                fontsize(size: number): string;
                fontsize(size: string): string;
                italics(): string;
                link(url: string): string;
                small(): string;
                strike(): string;
                sub(): string;
                sup(): string;
                padStart(maxLength: number, fillString?: string): string;
                padEnd(maxLength: number, fillString?: string): string;
                trimEnd(): string;
                trimStart(): string;
                trimLeft(): string;
                trimRight(): string;
                matchAll(regexp: RegExp): RegExpStringIterator<RegExpExecArray>;
                [Symbol.iterator](): StringIterator<string>;
            };
            validate(string: any): string is string;
            fromCharCode(...codes: number[]): string;
            fromCodePoint(...codePoints: number[]): string;
            raw(template: {
                raw: readonly string[] | ArrayLike<string>;
            }, ...substitutions: any[]): string;
        };
        JSONString: {
            new (value?: any): {
                readonly [index: number]: string;
                toString(): string;
                charAt(pos: number): string;
                charCodeAt(index: number): number;
                concat(...strings: string[]): string;
                indexOf(searchString: string, position?: number): number;
                lastIndexOf(searchString: string, position?: number): number;
                localeCompare(that: string): number;
                localeCompare(that: string, locales?: string | string[], options?: Intl.CollatorOptions): number;
                localeCompare(that: string, locales?: Intl.LocalesArgument, options?: Intl.CollatorOptions): number;
                match(regexp: string | RegExp): RegExpMatchArray | null;
                match(matcher: {
                    [Symbol.match](string: string): RegExpMatchArray | null;
                }): RegExpMatchArray | null;
                replace(searchValue: string | RegExp, replaceValue: string): string;
                replace(searchValue: string | RegExp, replacer: (substring: string, ...args: any[]) => string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replaceValue: string): string;
                }, replaceValue: string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replacer: (substring: string, ...args: any[]) => string): string;
                }, replacer: (substring: string, ...args: any[]) => string): string;
                search(regexp: string | RegExp): number;
                search(searcher: {
                    [Symbol.search](string: string): number;
                }): number;
                slice(start?: number, end?: number): string;
                split(separator: string | RegExp, limit?: number): string[];
                split(splitter: {
                    [Symbol.split](string: string, limit?: number): string[];
                }, limit?: number): string[];
                substring(start: number, end?: number): string;
                toLowerCase(): string;
                toLocaleLowerCase(locales?: string | string[]): string;
                toLocaleLowerCase(locales?: Intl.LocalesArgument): string;
                toUpperCase(): string;
                toLocaleUpperCase(locales?: string | string[]): string;
                toLocaleUpperCase(locales?: Intl.LocalesArgument): string;
                trim(): string;
                readonly length: number;
                substr(from: number, length?: number): string;
                valueOf(): string;
                codePointAt(pos: number): number | undefined;
                includes(searchString: string, position?: number): boolean;
                endsWith(searchString: string, endPosition?: number): boolean;
                normalize(form: "NFC" | "NFD" | "NFKC" | "NFKD"): string;
                normalize(form?: string): string;
                repeat(count: number): string;
                startsWith(searchString: string, position?: number): boolean;
                anchor(name: string): string;
                big(): string;
                blink(): string;
                bold(): string;
                fixed(): string;
                fontcolor(color: string): string;
                fontsize(size: number): string;
                fontsize(size: string): string;
                italics(): string;
                link(url: string): string;
                small(): string;
                strike(): string;
                sub(): string;
                sup(): string;
                padStart(maxLength: number, fillString?: string): string;
                padEnd(maxLength: number, fillString?: string): string;
                trimEnd(): string;
                trimStart(): string;
                trimLeft(): string;
                trimRight(): string;
                matchAll(regexp: RegExp): RegExpStringIterator<RegExpExecArray>;
                [Symbol.iterator](): StringIterator<string>;
            };
            validate(value: any): boolean;
            inputMapper(value: any): any;
            fromCharCode(...codes: number[]): string;
            fromCodePoint(...codePoints: number[]): string;
            raw(template: {
                raw: readonly string[] | ArrayLike<string>;
            }, ...substitutions: any[]): string;
        };
        NumberString: {
            new (value?: any): {
                readonly [index: number]: string;
                toString(): string;
                charAt(pos: number): string;
                charCodeAt(index: number): number;
                concat(...strings: string[]): string;
                indexOf(searchString: string, position?: number): number;
                lastIndexOf(searchString: string, position?: number): number;
                localeCompare(that: string): number;
                localeCompare(that: string, locales?: string | string[], options?: Intl.CollatorOptions): number;
                localeCompare(that: string, locales?: Intl.LocalesArgument, options?: Intl.CollatorOptions): number;
                match(regexp: string | RegExp): RegExpMatchArray | null;
                match(matcher: {
                    [Symbol.match](string: string): RegExpMatchArray | null;
                }): RegExpMatchArray | null;
                replace(searchValue: string | RegExp, replaceValue: string): string;
                replace(searchValue: string | RegExp, replacer: (substring: string, ...args: any[]) => string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replaceValue: string): string;
                }, replaceValue: string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replacer: (substring: string, ...args: any[]) => string): string;
                }, replacer: (substring: string, ...args: any[]) => string): string;
                search(regexp: string | RegExp): number;
                search(searcher: {
                    [Symbol.search](string: string): number;
                }): number;
                slice(start?: number, end?: number): string;
                split(separator: string | RegExp, limit?: number): string[];
                split(splitter: {
                    [Symbol.split](string: string, limit?: number): string[];
                }, limit?: number): string[];
                substring(start: number, end?: number): string;
                toLowerCase(): string;
                toLocaleLowerCase(locales?: string | string[]): string;
                toLocaleLowerCase(locales?: Intl.LocalesArgument): string;
                toUpperCase(): string;
                toLocaleUpperCase(locales?: string | string[]): string;
                toLocaleUpperCase(locales?: Intl.LocalesArgument): string;
                trim(): string;
                readonly length: number;
                substr(from: number, length?: number): string;
                valueOf(): string;
                codePointAt(pos: number): number | undefined;
                includes(searchString: string, position?: number): boolean;
                endsWith(searchString: string, endPosition?: number): boolean;
                normalize(form: "NFC" | "NFD" | "NFKC" | "NFKD"): string;
                normalize(form?: string): string;
                repeat(count: number): string;
                startsWith(searchString: string, position?: number): boolean;
                anchor(name: string): string;
                big(): string;
                blink(): string;
                bold(): string;
                fixed(): string;
                fontcolor(color: string): string;
                fontsize(size: number): string;
                fontsize(size: string): string;
                italics(): string;
                link(url: string): string;
                small(): string;
                strike(): string;
                sub(): string;
                sup(): string;
                padStart(maxLength: number, fillString?: string): string;
                padEnd(maxLength: number, fillString?: string): string;
                trimEnd(): string;
                trimStart(): string;
                trimLeft(): string;
                trimRight(): string;
                matchAll(regexp: RegExp): RegExpStringIterator<RegExpExecArray>;
                [Symbol.iterator](): StringIterator<string>;
            };
            validate(string: any): boolean;
            fromCharCode(...codes: number[]): string;
            fromCodePoint(...codePoints: number[]): string;
            raw(template: {
                raw: readonly string[] | ArrayLike<string>;
            }, ...substitutions: any[]): string;
        };
        Email: {
            new (value?: any): {
                readonly [index: number]: string;
                toString(): string;
                charAt(pos: number): string;
                charCodeAt(index: number): number;
                concat(...strings: string[]): string;
                indexOf(searchString: string, position?: number): number;
                lastIndexOf(searchString: string, position?: number): number;
                localeCompare(that: string): number;
                localeCompare(that: string, locales?: string | string[], options?: Intl.CollatorOptions): number;
                localeCompare(that: string, locales?: Intl.LocalesArgument, options?: Intl.CollatorOptions): number;
                match(regexp: string | RegExp): RegExpMatchArray | null;
                match(matcher: {
                    [Symbol.match](string: string): RegExpMatchArray | null;
                }): RegExpMatchArray | null;
                replace(searchValue: string | RegExp, replaceValue: string): string;
                replace(searchValue: string | RegExp, replacer: (substring: string, ...args: any[]) => string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replaceValue: string): string;
                }, replaceValue: string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replacer: (substring: string, ...args: any[]) => string): string;
                }, replacer: (substring: string, ...args: any[]) => string): string;
                search(regexp: string | RegExp): number;
                search(searcher: {
                    [Symbol.search](string: string): number;
                }): number;
                slice(start?: number, end?: number): string;
                split(separator: string | RegExp, limit?: number): string[];
                split(splitter: {
                    [Symbol.split](string: string, limit?: number): string[];
                }, limit?: number): string[];
                substring(start: number, end?: number): string;
                toLowerCase(): string;
                toLocaleLowerCase(locales?: string | string[]): string;
                toLocaleLowerCase(locales?: Intl.LocalesArgument): string;
                toUpperCase(): string;
                toLocaleUpperCase(locales?: string | string[]): string;
                toLocaleUpperCase(locales?: Intl.LocalesArgument): string;
                trim(): string;
                readonly length: number;
                substr(from: number, length?: number): string;
                valueOf(): string;
                codePointAt(pos: number): number | undefined;
                includes(searchString: string, position?: number): boolean;
                endsWith(searchString: string, endPosition?: number): boolean;
                normalize(form: "NFC" | "NFD" | "NFKC" | "NFKD"): string;
                normalize(form?: string): string;
                repeat(count: number): string;
                startsWith(searchString: string, position?: number): boolean;
                anchor(name: string): string;
                big(): string;
                blink(): string;
                bold(): string;
                fixed(): string;
                fontcolor(color: string): string;
                fontsize(size: number): string;
                fontsize(size: string): string;
                italics(): string;
                link(url: string): string;
                small(): string;
                strike(): string;
                sub(): string;
                sup(): string;
                padStart(maxLength: number, fillString?: string): string;
                padEnd(maxLength: number, fillString?: string): string;
                trimEnd(): string;
                trimStart(): string;
                trimLeft(): string;
                trimRight(): string;
                matchAll(regexp: RegExp): RegExpStringIterator<RegExpExecArray>;
                [Symbol.iterator](): StringIterator<string>;
            };
            validate(string: any): boolean;
            fromCharCode(...codes: number[]): string;
            fromCodePoint(...codePoints: number[]): string;
            raw(template: {
                raw: readonly string[] | ArrayLike<string>;
            }, ...substitutions: any[]): string;
        };
        URL: {
            new (value?: any): {
                readonly [index: number]: string;
                toString(): string;
                charAt(pos: number): string;
                charCodeAt(index: number): number;
                concat(...strings: string[]): string;
                indexOf(searchString: string, position?: number): number;
                lastIndexOf(searchString: string, position?: number): number;
                localeCompare(that: string): number;
                localeCompare(that: string, locales?: string | string[], options?: Intl.CollatorOptions): number;
                localeCompare(that: string, locales?: Intl.LocalesArgument, options?: Intl.CollatorOptions): number;
                match(regexp: string | RegExp): RegExpMatchArray | null;
                match(matcher: {
                    [Symbol.match](string: string): RegExpMatchArray | null;
                }): RegExpMatchArray | null;
                replace(searchValue: string | RegExp, replaceValue: string): string;
                replace(searchValue: string | RegExp, replacer: (substring: string, ...args: any[]) => string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replaceValue: string): string;
                }, replaceValue: string): string;
                replace(searchValue: {
                    [Symbol.replace](string: string, replacer: (substring: string, ...args: any[]) => string): string;
                }, replacer: (substring: string, ...args: any[]) => string): string;
                search(regexp: string | RegExp): number;
                search(searcher: {
                    [Symbol.search](string: string): number;
                }): number;
                slice(start?: number, end?: number): string;
                split(separator: string | RegExp, limit?: number): string[];
                split(splitter: {
                    [Symbol.split](string: string, limit?: number): string[];
                }, limit?: number): string[];
                substring(start: number, end?: number): string;
                toLowerCase(): string;
                toLocaleLowerCase(locales?: string | string[]): string;
                toLocaleLowerCase(locales?: Intl.LocalesArgument): string;
                toUpperCase(): string;
                toLocaleUpperCase(locales?: string | string[]): string;
                toLocaleUpperCase(locales?: Intl.LocalesArgument): string;
                trim(): string;
                readonly length: number;
                substr(from: number, length?: number): string;
                valueOf(): string;
                codePointAt(pos: number): number | undefined;
                includes(searchString: string, position?: number): boolean;
                endsWith(searchString: string, endPosition?: number): boolean;
                normalize(form: "NFC" | "NFD" | "NFKC" | "NFKD"): string;
                normalize(form?: string): string;
                repeat(count: number): string;
                startsWith(searchString: string, position?: number): boolean;
                anchor(name: string): string;
                big(): string;
                blink(): string;
                bold(): string;
                fixed(): string;
                fontcolor(color: string): string;
                fontsize(size: number): string;
                fontsize(size: string): string;
                italics(): string;
                link(url: string): string;
                small(): string;
                strike(): string;
                sub(): string;
                sup(): string;
                padStart(maxLength: number, fillString?: string): string;
                padEnd(maxLength: number, fillString?: string): string;
                trimEnd(): string;
                trimStart(): string;
                trimLeft(): string;
                trimRight(): string;
                matchAll(regexp: RegExp): RegExpStringIterator<RegExpExecArray>;
                [Symbol.iterator](): StringIterator<string>;
            };
            validate(string: any): boolean;
            fromCharCode(...codes: number[]): string;
            fromCodePoint(...codePoints: number[]): string;
            raw(template: {
                raw: readonly string[] | ArrayLike<string>;
            }, ...substitutions: any[]): string;
        };
        UNIX_TIMESTAMP: {
            new (): {};
            validate(value: any): boolean;
            inputMapper(value: any): number;
        };
        DateTime: {
            new (): {};
            validate(value: any): boolean;
            inputMapper(value: any): string;
        };
    };
    /**
     * @param {string} [table]
     * @returns {Schema<T>}
     */
    static UPDATE(table?: string): Schema<T>;
    /**
     * @template {Record<string, any>} T\
     * @param {WhereClause} whereClause
     * @returns {Schema<T>}
     */
    static FIND<T_1 extends Record<string, any>>(...whereClause: WhereClause): Schema<T_1>;
    /**
   * @template {Record<string, any>} T
   * @param {any} pk
   * @returns {Schema<T>}
   */
    static FIND_PK<T_1 extends Record<string, any>>(pk: any): Schema<T_1>;
    static get _pk(): string;
    /**
   * Construct a model instance from DB row data
   * @param {Partial<T>} [dict]
   */
    constructor(dict?: Partial<T>);
    _q: any[];
    /**
   * @param {(keyof T | string)[]} [columns]
   * @returns {this}
   */
    SELECT(columns?: (keyof T | string)[]): this;
    /**
   * @param {string} [table]
   * @returns {this}
   */
    FROM(table?: string): this;
    /**
   * @param {string} on
   * @param {any} [values]
   * @returns {this}
   */
    JOIN(whereClause: any, whereClause2: any): this;
    /**
   * @param {string} on
   * @param {any} [values]
   * @returns {this}
   */
    LEFTJOIN(whereClause: any, whereClause2: any): this;
    /**
   * @param {WhereClause} where
   * @param {any} [value]
   * @returns {this}
   */
    WHERE(whereClause: any, whereClause2: any): this;
    /**
   * @param {WhereClause} where
   * @param {any} [value]
   * @returns {this}
   */
    AND(whereClause: any, whereClause2: any, { isExec }?: {
        isExec?: boolean;
    }): this;
    WHERE_AND(obj: any): this;
    /**
   * @param {WhereClause} where
   * @param {any} [value]
   * @returns {this}
   */
    OR(whereClause: any, whereClause2: any, { isExec }?: {
        isExec?: boolean;
    }): this;
    /**
   * @param {...string} columns
   * @returns {this}
   */
    HAVING(...column: any[]): this;
    /**
   * @param {...string} columns
   * @returns {this}
   */
    GROUP_BY(...column: any[]): this;
    /**
   * @param {string} column
   * @param {'ASC' | 'DESC'} [sort]
   * @returns {this}
   */
    ORDER_BY(column: string, sort?: "ASC" | "DESC"): this;
    /**
   * @param {number} [limit]
   * @param {number} [defaultValue]
   * @returns {this}
   */
    LIMIT(numbers: any, defaultValue?: number, { isExec }?: {
        isExec?: boolean;
    }): this;
    /**
   * @param {number} [offset]
   * @param {number} [defaultValue]
   * @returns {this}
   */
    OFFSET(numbers: any, defaultValue?: number, { isExec }?: {
        isExec?: boolean;
    }): this;
    /**
   * @param {...string} fields
   * @returns {this}
   */
    POPULATE(...fields: string[]): this;
    /**
   * @param {boolean} [ignore]
   * @returns {this}
   */
    INSERT(ignore?: boolean): this;
    /**
   * @param {string} [table]
   * @returns {this}
   */
    INTO(table?: string): this;
    /**
   * @returns {this}
   */
    DELETE(): this;
    /**
     * @param {boolean} [option=true]
     * @returns {this}
     */
    PRINT(option?: boolean): this;
    /**
     * @param {((err: any) => any) | string} callbackOrString
     * @returns {this}
     */
    ON_ERR(callbackOrString: ((err: any) => any) | string): this;
    /**
     * @param {boolean} [useWriter=true]
     * @returns {this}
     */
    WRITER(useWriter?: boolean): this;
    /**
     * @returns {this}
     */
    NESTTABLES(): this;
    _nestTables: boolean;
    /**
     * @template U
     * @param {(row: T) => U} cb
     * @returns {this}
     */
    MAP<U>(mapCallback: any): this;
    /**
     * @template U
     * @param {(acc: U, curr: T) => U} cb
     * @param {U} [initVal]
     * @returns {this}
     */
    REDUCE<U>(reduceCallback: any, reduceInitVal?: any): this;
    /**
     * @returns {this}
     */
    NESTED(): this;
    /**
     * @param {number} expireSecond
     * @param {{key?: string; forceUpdate?: boolean; shouldRefreshInCache?: (cached: any) => boolean}} [options]
     * @returns {this}
     */
    EX(expireSecond: number, { key, forceUpdate, shouldRefreshInCache }?: {
        key?: string;
        forceUpdate?: boolean;
        shouldRefreshInCache?: (cached: any) => boolean;
    }): this;
    /**
     * @param {boolean} [formatted=true]
     * @returns {{query: {sql: string; nestTables: boolean}; values: any[]; formatted: string | null}}
     */
    FORMATTED(formatted?: boolean): {
        query: {
            sql: string;
            nestTables: boolean;
        };
        values: any[];
        formatted: string | null;
    };
    /**
     * @returns {boolean}
     */
    shouldMock(): boolean;
    /**
     * @param {string} formatted
     * @returns {any}
     */
    mocked(formatted: string): any;
    /**
     * @param {Connection} [outSideConnection]
     * @returns {Promise<any>}
     */
    rollback(outSideConnection?: Connection): Promise<any>;
    /**
     * @param {Connection} [outSideConnection]
     * @param {any} [options]
     * @returns {Promise<any>}
     */
    exec(outSideConnection?: Connection, options?: any): Promise<any>;
    /**
        * stream query from database, await just waiting for generate reader connection
        *
        * @param {Connection} [connection] - connection instance
        * @param {number} [highWaterMark] number of rows return in one time
        * @param {Callback} [onValue] value handler
        * @param {Callback} [onEnd] end handler
     * @returns {Promise<void>}
     */
    stream({ connection, highWaterMark, onValue, onEnd }?: Connection): Promise<void>;
    _stream({ connection: outSideConnection, highWaterMark, onValue, onEnd }: {
        connection: any;
        highWaterMark?: number;
        onValue?: (value: any, done: any) => Promise<void>;
        onEnd?: () => Promise<void>;
    }): Promise<void>;
    get JSON(): this;
    get PRIVATE(): this;
    /**
     * @param {string} [table]
     * @returns {this}
     */
    UPDATE(table?: string): this;
    /**
     * @param {Record<string, any> | string} whereClause
     * @param {any} [whereClause2]
     * @param {{passUndefined: boolean; encryption: string[]}} [options]
     * @returns {this}
     */
    SET(whereClause: Record<string, any> | string, whereClause2?: any, { passUndefined, encryption }?: {
        passUndefined: boolean;
        encryption: string[];
    }): this;
    /**
     * @param {any[][]} values
     * @returns {this}
     */
    VALUES(values: any[][]): this;
    /**
     * @param {Record<string, any> | string} whereClause
     * @param {any} [whereClause2]
     * @returns {this}
     */
    DUPLICATE(whereClause: Record<string, any> | string, whereClause2?: any): this;
    /**
     * @returns {this}
     */
    FIRST(): this;
    /**
     * @param {(row: T) => boolean} callback
     * @returns {this}
     */
    FILTER(callback: (row: T) => boolean): this;
    /**
     * @returns {Promise<void>}
     */
    save(): Promise<void>;
    get _pk(): string;
    _PRE(command: any): this;
    _pre: string;
    _AFTER(command: any): this;
    _after: string;
    /**
   * @param {...(keyof T | string)} columns
   * @returns {this}
   */
    DECRYPT(...decryption: any[]): this;
    /**
   * @param {...(keyof T | string)} columns
   * @returns {this}
   */
    ENCRYPT(...encryption: any[]): this;
    /**
     * @returns {this}
     */
    COMBINE(): this;
    /**
   * @param {...string} variables
   * @returns {this}
   */
    UPDATED(...variables: string[]): this;
    /**
   * @param {number} rows
   * @returns {this}
   */
    CHANGED_ROWS(changedRows: any): this;
    /**
   * @param {number} affectedRows
   * @returns {this}
   */
    AFFECTED_ROWS(affectedRows: number): this;
    _options(): {
        query: {
            sql: string;
            nestTables: boolean;
        };
        values: any[];
        formatted: string;
        mapCallback: any;
        reduceCallback: any;
        reduceInitVal: any;
        nested: any;
        print: any;
        filter: any;
        getFirst: any;
        updated: any;
        changedRows: any;
        affectedRows: any;
        onErr: any;
        decryption: any[];
        populates: any[];
        useWriter: boolean;
        encryption: any[];
        ex: any;
    };
    _resetQueryOptions(): void;
    _queryOptions: {
        decryption: any[];
        populates: any[];
        useWriter: boolean;
        encryption: any[];
    };
    validate(isInsert: any): boolean;
}
declare namespace Schema {
    export { Connection, WhereClause, StreamOptions };
}
import Encryption = require("./Schema/Encryption");
type Connection = import("./Connection");
type WhereClause = string | Record<string, any> | [string, any] | [string, any[]];
type StreamOptions = {
    connection?: Connection;
    highWaterMark?: number;
    onValue?: (value: any, done?: () => void) => void | Promise<void>;
    onEnd?: (err?: any) => void | Promise<void>;
};
