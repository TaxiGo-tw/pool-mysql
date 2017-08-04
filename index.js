var mysql = require('mysql');

const writerPool = mysql.createPool({
	connectionLimit: process.env.CONNECTION_LIMIT || 30,
	host: process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD || '123',
	database: process.env.SQL_TABLE || 'test',
	multipleStatements: true,
})
setPool(writerPool)

const readerPool = mysql.createPool({
	connectionLimit: process.env.CONNECTION_LIMIT_READER || process.env.CONNECTION_LIMIT || 30,
	host: process.env.SQL_HOST_READER || process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER_READER || process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD_READER || process.env.SQL_PASSWORD || '123',
	database: process.env.SQL_TABLE || 'test',
	multipleStatements: true,
})
setPool(readerPool)


var logLevel = {
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

	}
}

var logger = logLevel.error

class Manager {
	constructor(reader, writer) {
		this.reader = reader
		this.writer = writer
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
		let connection = this.getReaderOrWriter(sql)
		let q = connection.query(sql, values, cb)
		logger(null, connection.logPrefix + ' : ' + q.sql)
	}


	q(sql, values) {
		return new Promise((reslove, reject) => {
			let connection = this.getReaderOrWriter(sql)
			let q = connection.query(sql, values, (e, r) => {
				logger(null, connection.logPrefix + ' : ' + q.sql)
				if (e) {
					logger(null, connection.logPrefix + '<SQL Error> :' + e.message)
					// process.env.NODE_ENV != 'development' ? logger(e) : 'nothing'
					reject(e)
				} else {
					reslove(r)
				}
			})
		})
	}

	commit(cb) {
		this.writer.commit((e) => {
			if (cb) {
				cb(e)
			}

			logger(e, this.writer.logPrefix + ' : commit')
			this.release()
		})
	}

	rollback() {
		return new Promise((resolve, reject) => {
			let x = this.reader.rollback(() => {
				let y = this.writer.rollback(() => {
					logger(null, '[' + (x._connection.threadId || 'default') + ']  : ' + x.sql)
					logger(null, '[' + (y._connection.threadId || 'default') + ']  : ' + y.sql)
					this.release()
					resolve()
				})
			})
		})
	}

	release() {
		if (readerPool._freeConnections.indexOf(this.reader) == -1) {
			this.reader.release()
			logger(null, this.reader.logPrefix + ' : Release')
		}

		if (writerPool._freeConnections.indexOf(this.writer) == -1) {
			this.writer.release()
			logger(null, this.writer.logPrefix + ' : Release')
		}
	}

	getReaderOrWriter(sql) {
		if ((/select/).test(sql.toLowerCase()) && sql.toLowerCase().indexOf('for update') == -1) {
			return this.reader
		}

		return this.writer
	}
}

//manager
class KerkerPool {
	set logger(string) {
		switch (string) {
			case 'all':
				logger = logLevel.all
				break
			case 'error':
				logger = logLevel.error
				break
			case 'none':
				logger = logLevel.none
				break;
		}
	}

	get logger() {
		return logger
	}

	createConnection() {
		return new Promise(async (resolve, reject) => {
			try {
				let reader = await readerPool.createConnection()
				reader.role = 'Reader'
				setConnection(reader)

				let writer = await writerPool.createConnection()
				writer.role = 'Writer'
				setConnection(writer)

				let manager = new Manager(reader, writer)

				resolve(manager)
			} catch (e) {
				reject(e)
			}
		})
	}

	query(sql, values, callback) {
		writerPool.query(sql, values, callback)
	}
}

manager = new KerkerPool()
module.exports = manager

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
				return callback(err, null)
			}

			connection.query(sql, values, (err, result) => {
				callback(err, result)
				connection.release()
			})
		})
	}
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
