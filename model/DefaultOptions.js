module.exports = {
	connectionLimit: process.env.CONNECTION_LIMIT || 30,
	writer: {
		host: process.env.SQL_HOST || '127.0.0.1',
		user: process.env.SQL_USER || 'root',
		password: process.env.SQL_PASSWORD || '123',
		database: process.env.SQL_TABLE || 'test',
		multipleStatements: true,
		charset: 'utf8mb4'
	},
	reader: {
		host: process.env.SQL_HOST_READER || process.env.SQL_HOST || '127.0.0.1',
		user: process.env.SQL_USER_READER || process.env.SQL_USER || 'root',
		password: process.env.SQL_PASSWORD_READER || process.env.SQL_PASSWORD || '123',
		database: process.env.SQL_TABLE || 'test',
		multipleStatements: true,
		charset: 'utf8mb4'
	}
}
