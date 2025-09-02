export = MySQLConnectionManager;
declare class MySQLConnectionManager {
    constructor(options: any);
    _options: any;
    _writerPool: MySQLConnectionPool;
    _readerPool: MySQLConnectionPool;
    getWriter(connection: any): Promise<any>;
    getReader(connection: any): Promise<any>;
    _getMysqlConnection({ options, role, connection }: {
        options: any;
        role: any;
        connection: any;
    }): Promise<any>;
    _connectionPool(role: any): MySQLConnectionPool;
}
import MySQLConnectionPool = require("./MySQLConnectionPool");
