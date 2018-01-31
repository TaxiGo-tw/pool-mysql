const mysql = require('mysql')

const writerOptions = {
	connectionLimit: process.env.CONNECTION_LIMIT || 30,
	host: process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD || '123',
	database: process.env.SQL_TABLE || 'test',
	multipleStatements: false,
	charset: 'utf8mb4'
}
const writerPool = mysql.createPool(writerOptions)
setPool(writerPool)

const readerOptions = {
	connectionLimit: process.env.CONNECTION_LIMIT_READER || process.env.CONNECTION_LIMIT || 30,
	host: process.env.SQL_HOST_READER || process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER_READER || process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD_READER || process.env.SQL_PASSWORD || '123',
	database: process.env.SQL_TABLE || 'test',
	multipleStatements: false,
	charset: 'utf8mb4'
}

const readerPool = mysql.createPool(readerOptions)
setPool(readerPool)


console.log('pool-mysql writer domain: ', writerOptions.host)
console.log('pool-mysql reader domain: ', readerOptions.host)

const logLevel = {
	all: (err, toPrint) => {
		console.log(toPrint)
	},
	error: (err, toPrint) => {
		if (!err) {
			return
		}
		console.log(toPrint)
	},
	none: (err, toPrint) => {

	},
	oneTime: (err, toPrint) => {
		console.log(toPrint)
		logger = logLevel.error
	}
}

let logger = logLevel.error

function trimed(params) {
	return params.replace(/\t/g, '').replace(/\n/g, ' ').trim()
}

class Connection {
	constructor(reader, writer) {
		this.reader = reader
		this.writer = writer
		this.useWriter = false
	}

	async beginTransaction(cb) {
		try {
			await this.reader.startTransaction()
			await this.writer.startTransaction()
			cb(undefined)
		} catch (e) {
			cb(e)
		}
	}

	async awaitTransaction() {
		return new Promise(async (resolve, reject) => {
			try {
				await this.reader.startTransaction()
				await this.writer.startTransaction()
				resolve()
			} catch (e) {
				reject(e)
			}
		})
	}

	query(sql, values, cb) {
		const connection = this.getReaderOrWriter(sql)
		const q = connection.query(sql, values, (a, b, c) => {
			cb(a, b, c)
		})

		logger(null, connection.logPrefix + ' : ' + q.sql)
		return {}
	}

	q(sql, values) {
		return new Promise((reslove, reject) => {
			const connection = this.useWriter ? this.writer : this.getReaderOrWriter(sql)
			this.useWriter = false
			const q = connection.query(trimed(sql), values, (e, r) => {
				logger(null, connection.logPrefix + ' : ' + q.sql)
				if (e) {
					logger(null, connection.logPrefix + '<SQL Error> :' + e.message)
					reject(e)
				} else {
					reslove(r)
				}
			})
		})
	}

	commit(cb) {
		this.writer.commit((e) => {
			if (this.writer) {
				logger(e, this.writer.logPrefix + ' : COMMIT')
			}

			if (cb) {
				cb(e)
			}
		})
	}

	rollback() {
		return new Promise((resolve, reject) => {
			const x = this.reader.rollback(() => {
				const y = this.writer.rollback(() => {
					logger(null, '[' + (x._connection.threadId || 'default') + ']  : ' + x.sql)
					logger(null, '[' + (y._connection.threadId || 'default') + ']  : ' + y.sql)
					resolve()
				})
			})
		})
	}

	release() {
		if (this.reader && readerPool._freeConnections.indexOf(this.reader)) {
			logger(null, this.reader.logPrefix + ' : RELEASE')
			this.reader.release()
		}

		if (this.writer && writerPool._freeConnections.indexOf(this.writer)) {
			logger(null, this.writer.logPrefix + ' : RELEASE')
			this.writer.release()
		}
	}

	getReaderOrWriter(sql) {
		if ((/^select/).test(sql.toLowerCase()) && sql.toLowerCase().indexOf('for update') == -1) {
			return this.reader
		}

		return this.writer
	}

	get forceWriter() {
		this.useWriter = true
		return this
	}

	get print() {
		logger = logLevel.oneTime
		return this
	}

	get mustAffected() {
		this.mustAffected = true
		return this
	}
}

//manager
class Pool {
	set logger(string) {
		switch (string) {
			case 'all':
				logger = logLevel.all
				break
			case 'error':
				logger = logLevel.error
				break
			default:
				logger = logLevel.none
				break
		}
	}

	get logger() {
		return logger
	}

	createConnection() {
		return new Promise(async (resolve, reject) => {
			try {
				const reader = await readerPool.createConnection()
				reader.role = 'Reader'
				setConnection(reader)

				const writer = await writerPool.createConnection()
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
		writerPool.query(sql, values, callback)

		return {}
	}
}

module.exports = new Pool()

function setPool(pool) {
	pool.createConnection = () => {
		return new Promise((resolve, reject) => {
			pool.getConnection((err, connection) => {
				if (err) {
					logger(err)
					return reject(err)
				}
				setConnection(connection)
				resolve(connection)
			})
		})
	}

	pool.query = (sql, values, callback) => {
		pool.getConnection((err, connection) => {
			connection.release()

			logger(err, 'pool.query')
			if (err) {
				return callback(err, null)
			}

			connection.query(sql, values, (err, result) => {
				callback(err, result)
			})
		})

		return {}
	}

	pool.release = () => { }
}

function setConnection(connection) {
	connection.q = (sql, values) => {
		return new Promise((resolve, reject) => {
			connection.query(sql, values, (err, result) => {
				if (err) {
					reject(err)
				} else {
					resolve(result)
				}
			})
		})
	}

	connection.startTransaction = () => {
		return new Promise((resolve, reject) => {
			connection.beginTransaction((err) => {
				if (err) {
					logger(err, undefined)
					reject(err)
				} else {
					resolve(connection)
				}
			})
		})
	}

	connection.commitChange = () => {
		return new Promise((resolve, reject) => {
			connection.commit((err) => {
				if (err) {
					logger(err, undefined)
					reject(err)
				} else {
					resolve(connection)
				}
			})
		})
	}

	connection.logPrefix = `[${(connection.threadId || 'default')}] ${connection.role}`
}
