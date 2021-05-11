const defaultOptions = {
	connectionLimit: process.env.CONNECTION_LIMIT || 30,
	writer: {
		host: process.env.SQL_HOST || '127.0.0.1',
		user: process.env.SQL_USER || 'root',
		password: process.env.SQL_PASSWORD || '123',
		database: process.env.SQL_DB || process.env.SQL_TABLE || 'test',
		multipleStatements: process.env.SQL_MULTIPLE_STATEMENTS || true,
		charset: 'utf8mb4'
	},
	reader: {
		host: process.env.SQL_HOST_READER || process.env.SQL_HOST || '127.0.0.1',
		user: process.env.SQL_USER_READER || process.env.SQL_USER || 'root',
		password: process.env.SQL_PASSWORD_READER || process.env.SQL_PASSWORD || '123',
		database: process.env.SQL_DB || process.env.SQL_TABLE || 'test',
		multipleStatements: process.env.SQL_MULTIPLE_STATEMENTS || true,
		charset: 'utf8mb4'
	}
}

module.exports = (options = {}) => {

	const writer = {
		...JSON.parse(JSON.stringify(defaultOptions.writer)),
		...options.writer
	}

	const reader = {
		...JSON.parse(JSON.stringify(defaultOptions.reader)),
		...options.reader
	}


	const result = {
		...JSON.parse(JSON.stringify(defaultOptions)),

		SQL_FREE_CONNECTIONS: process.env.SQL_FREE_CONNECTIONS || 10,
		QUERY_THRESHOLD_START: process.env.QUERY_THRESHOLD_START || 60 * 1000,
		QUERY_THRESHOLD_MS: process.env.QUERY_THRESHOLD_MS || 500,
		DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY || 'abc',
		DATA_ENCRYPTION_IV: process.env.DATA_ENCRYPTION_IV || 'abc',
		REDIS_HOST: process.env.REDIS_HOST,
		REDIS_PORT: process.env.REDIS_PORT,
		...options,
	}

	result.writer = writer
	result.reader = reader

	return result
}
