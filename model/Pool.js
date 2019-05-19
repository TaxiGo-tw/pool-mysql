require('./Misc')
require('./Connection')
const LogLevel = require('./LogLevel')

const defaultOptions = {
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

//manager
class Pool {
	constructor({ options, redisClient } = {}) {
		this.options = options || defaultOptions

		this.connectionPool = {
			using: [],
			waiting: []
		}

		this._logger = LogLevel.error
		this.redisClient = redisClient

		console.log('pool-mysql writer host: ', this.options.writer.host)
		console.log('pool-mysql reader host: ', this.options.reader.host)
	}

	get Schema() {
		return require('./Schema')
	}

	get logger() {
		return this._logger
	}

	set logger(string) {
		switch (string) {
			case 'all':
				this._logger = LogLevel.all
				break
			case 'error':
				this._logger = LogLevel.error
				break
			default:
				this._logger = LogLevel.none
				break
		}
	}

	get redisClient() {
		return this._redisClient
	}

	set redisClient(newValue) {
		this._redisClient = newValue

		if (!this._redisClient) {
			return
		}

		if (!this._redisClient.getJSONAsync) {
			this._redisClient.getJSONAsync = async (...args) => {
				const result = await pool.redisClient.getAsync(...args)
				return JSON.parse(result)
			}
		}

		if (!this._redisClient.setJSONAsync) {
			this._redisClient.setJSONAsync = async (...args) => {
				args[1] = JSON.stringify(args[1])
				return await pool.redisClient.setAsync(...args)
			}
		}
	}

	getConnection(callback) {

	}

	async createConnection() {
		return new Promise(async (resolve, reject) => {
			try {
				// const reader = await readerPool.createConnection()
				const reader = await crConnection('reader')
				reader.role = 'Reader'
				setConnection(reader)


				// const writer = await writerPool.createConnection()
				const writer = await crConnection('writer')
				writer.role = 'Writer'
				setConnection(writer)

				const manager = new Connection(reader, writer)

				resolve(manager)
			} catch (e) {
				reject(e)
			}
		})
	}

	query(sql, values, callback) {
		this.createConnection().then(connection => {
			connection.query(sql, values, callback)
		})
		// writerPool.query(sql, values, callback)
		return {}
	}
}


module.exports = new Pool()

// function setPool(pool) {
// 	pool.createConnection = () => {
// 		return new Promise((resolve, reject) => {
// 			pool.getConnection((err, connection) => {
// 				if (err) {
// 					logger(err)
// 					return reject(err)
// 				}
// 				setConnection(connection)
// 				resolve(connection)
// 			})
// 		})
// 	}

// 	pool.query = (sql, values, callback) => {
// 		pool.getConnection((err, connection) => {
// 			logger(err, 'pool.query')
// 			if (err) {
// 				connection.release()
// 				return callback(err, null)
// 			}

// 			connection.query(sql, values, (err, result) => {
// 				connection.release()
// 				callback(err, result)
// 			})
// 		})

// 		return {}
// 	}

// 	pool.release = () => { }
// }
