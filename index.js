const mysql = require('mysql')

const writerOptions = {
	connectionLimit: process.env.CONNECTION_LIMIT || 30,
	host: process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD || '123',
	database: process.env.SQL_TABLE || 'test',
	multipleStatements: true,
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
	multipleStatements: true,
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

	async awaitCommit() {
		return new Promise(async (resolve, reject) => {
			try {
				await this.reader.commit()
				await this.writer.commit()
				resolve()
			} catch (e) {
				reject(e)
			}
		})
	}

	query(sql, values, cb) {
		const connection = this.useWriter ? this.writer : this.getReaderOrWriter(sql)
		this.useWriter = false

		let command = sql
		if (this.isSelect(sql) && this._noCache) {
			command = sql.replace(/select/gi, 'SELECT SQL_NO_CACHE ')
		}
		this._noCache = false


		const mustUpdateOneRow = this._mustUpdateOneRow
		this._mustUpdateOneRow = false

		const q = connection.query(trimed(command), values, (a, b, c) => {
			if (mustUpdateOneRow && b && b.affectedRows != 1) {
				// console.log(a, b, c)
				return cb(a || Error('MUST_UPDATE_ONE_ROW'), b, c)
			} else if (mustUpdateOneRow && b && b.affectedRows == 1) {
				// console.log(a, b, c)
				// console.log('changed a row')
			}

			cb(a, b, c)
		})

		const string = mustUpdateOneRow ? 'mustUpdateOneRow' : ''

		logger(null, `${connection.logPrefix} : (${string}) ${q.sql}`)

		return {}
	}

	q(sql, values) {
		return new Promise((reslove, reject) => {
			this.query(sql, values, (err, res) => {
				if (err) {
					reject(err)
				} else {
					reslove(res)
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

	isSelect(sql) {
		const command = trimed(sql.toLowerCase())

		if ((/^select/i).test(command) && command.indexOf('for update') == -1) {
			return true
		}
		return false
	}

	getReaderOrWriter(sql) {
		return this.isSelect(sql) ? this.reader : this.writer
	}

	get forceWriter() {
		this.useWriter = true
		return this
	}

	get print() {
		logger = logLevel.oneTime
		return this
	}

	get noCache() {
		this._noCache = true
		return this
	}

	get mustAffected() {
		this._mustAffected = true
		return this
	}

	get mustUpdateOneRow() {
		this._mustUpdateOneRow = true
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
			logger(err, 'pool.query')
			if (err) {
				connection.release()
				return callback(err, null)
			}

			connection.query(sql, values, (err, result) => {
				connection.release()
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
