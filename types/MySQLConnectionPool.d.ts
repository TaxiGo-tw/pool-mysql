export = MySQLConnectionPool;
declare class MySQLConnectionPool {
    constructor(option: any);
    option: any;
    connectionRequests: any[];
    waiting: any[];
    using: {};
    connectionID: number;
    identity(mysqlConnection?: {}): string;
    get _waitingCount(): number;
    get _usingCount(): any;
    numberOfConnections(mysqlConnection: any): any;
    _numberOfConnections: any;
    createConnection(option: any, role: any, connection: any): Promise<any>;
    _createConnection(option: any, role: any, connection: any, callback: any): any;
    _getNextWaitingCallback(): any;
    _decorator(mysqlConnection: any, connection: any): void;
    _runSchedulers(): void;
}
