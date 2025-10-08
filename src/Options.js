const defaultWriter = {
	host: process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD || '123',
	port: process.env.SQL_PORT || 3306,
	database: process.env.SQL_DB || process.env.SQL_TABLE || 'test',
	multipleStatements: process.env.SQL_MULTIPLE_STATEMENTS || true,
	charset: 'utf8mb4',
	connectTimeout: process.env.SQL_CONNECT_TIMEOUT ? parseInt(process.env.SQL_CONNECT_TIMEOUT) : 30000,
	acquireTimeout: process.env.SQL_ACQUIRE_TIMEOUT ? parseInt(process.env.SQL_ACQUIRE_TIMEOUT) : 30000,
}

const defaultReader = {
	host: process.env.SQL_HOST_READER || process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER_READER || process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD_READER || process.env.SQL_PASSWORD || '123',
	port: process.env.SQL_PORT || 3306,
	database: process.env.SQL_DB || process.env.SQL_TABLE || 'test',
	multipleStatements: process.env.SQL_MULTIPLE_STATEMENTS || true,
	charset: 'utf8mb4',
	connectTimeout: process.env.SQL_CONNECT_TIMEOUT ? parseInt(process.env.SQL_CONNECT_TIMEOUT) : 30000,
	acquireTimeout: process.env.SQL_ACQUIRE_TIMEOUT ? parseInt(process.env.SQL_ACQUIRE_TIMEOUT) : 30000,
}

module.exports = (options = {}, poolID) => {
	const result = {
		SQL_FREE_CONNECTIONS: process.env.SQL_FREE_CONNECTIONS || 10,
		QUERY_THRESHOLD_START: process.env.QUERY_THRESHOLD_START || 60 * 1000,
		QUERY_THRESHOLD_MS: process.env.QUERY_THRESHOLD_MS || 500,
		DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
		DATA_ENCRYPTION_IV: process.env.DATA_ENCRYPTION_IV,
		REDIS_HOST: process.env.REDIS_HOST,
		REDIS_PORT: process.env.REDIS_PORT,
		connectionLimit: process.env.CONNECTION_LIMIT || 30,

		//有多少在排隊時, 拿 connection會直接fail
		maxRequesting: process.env.MAX_REQUESTING || 1000,

		forceWriter: false,

		...options,

		writer: {
			connectionLimit: process.env.CONNECTION_LIMIT || 30,
			...defaultWriter,
			...options.writer,
			role: 'Writer',
			poolID
		},
		reader: {
			connectionLimit: process.env.CONNECTION_LIMIT || 30,
			...defaultReader,
			...options.reader,
			role: 'Reader',
			poolID
		},
		poolID
	}

	return result
}
