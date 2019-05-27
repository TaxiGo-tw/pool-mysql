const mysql = require('mysql')
require('./Misc')

const options = {
	writer: {
		connectionLimit: process.env.CONNECTION_LIMIT || 30,
		host: process.env.SQL_HOST || '127.0.0.1',
		user: process.env.SQL_USER || 'root',
		password: process.env.SQL_PASSWORD || '123',
		database: process.env.SQL_TABLE || 'test',
		multipleStatements: true,
		charset: 'utf8mb4'
	},
	reader: {
		connectionLimit: process.env.CONNECTION_LIMIT_READER || process.env.CONNECTION_LIMIT || 30,
		host: process.env.SQL_HOST_READER || process.env.SQL_HOST || '127.0.0.1',
		user: process.env.SQL_USER_READER || process.env.SQL_USER || 'root',
		password: process.env.SQL_PASSWORD_READER || process.env.SQL_PASSWORD || '123',
		database: process.env.SQL_TABLE || 'test',
		multipleStatements: true,
		charset: 'utf8mb4'
	}
}

const newConnection = async (role = 'reader') => {
	const option = role == 'writer' ? option.writer : option.reader

	return new Promise((resolve, reject) => {
		const connection = mysql.createConnection(option)

		connection.connect((err) => {
			if (err) {
				logger(err)
				return reject(err)
			}

			setConnection(connection)
			resolve(connection)
		})
	})
}

class Manager {
	constructor() {
		this.connections = []
	}


	query(sql, values, cb) {

	}

	async createConnection() {
		for (const connection of this.connections) {
			if (connection.isUsing) {
				continue
			}

			return connection
		}

		newConnection()
	}

	release() { }
}



module.exports = new Manager()
