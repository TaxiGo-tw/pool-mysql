var mysql = require('mysql');

const writerPool = mysql.createPool({
	connectionLimit: process.env.CONNECTION_LIMIT || 30,
	host: process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD || '123',
	database: process.env.SQL_TABLE || 'test',
	multipleStatements: true,
});
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
		console.log(connection.logPrefix + '<SQL> : ' + q.sql)
	}


	q(sql, values) {
		return new Promise((reslove, reject) => {
			let connection = this.getReaderOrWriter(sql)
			let q = connection.query(sql, values, (e, r) => {
				console.log(connection.logPrefix + '<SQL> : ' + q.sql)
				if (e) {
					console.log(connection.logPrefix + '<SQL Error> :' + e.message)
					process.env.NODE_ENV != 'development' ? console.log(e) : 'nothing'
					reject(e)
				} else {
					reslove(r)
				}
			})
		})
	}

	commit() {
		console.log('commit')

		return new Promise((resolve, reject) => {
			this.reader.commit(() => {
				this.writer.commit(() => {
					this.release()
					resolve()
				})
			})
		})
	}

	rollback() {
		return new Promise((resolve, reject) => {
			let x = this.reader.rollback(() => {
				let y = this.writer.rollback(() => {
					console.log('[' + (x._connection.threadId || 'default') + '] <SQL> : ' + x.sql)
					console.log('[' + (y._connection.threadId || 'default') + '] <SQL> : ' + y.sql)
					this.release()
					resolve()
				})
			})
		})
	}

	release() {
		if (readerPool._freeConnections.indexOf(this.reader) == -1) {
			this.reader.release()
			console.log(this.reader.logPrefix + '<SQL> : Release')
		}

		if (writerPool._freeConnections.indexOf(this.writer) == -1) {
			this.writer.release()
			console.log(this.writer.logPrefix + '<SQL> : Release')
		}
	}

	getReaderOrWriter(sql) {
		if ((/(SELECT|select)/).test(sql)) {
			console.log('get Reader')
			return this.reader
		} else {
			console.log('get Writer')
			return this.writer
		}
	}
}

//manager
class KerkerPool {
	createConnection() {
		return new Promise(async (resolve, reject) => {
			try {
				let reader = await readerPool.createConnection()
				setConnection(reader)
				let writer = await writerPool.createConnection()
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
					console.log(err)
					return reject(err)
				}
				setConnection(connection)
				resolve(connection)
			})
		})
	}

	pool.query = (sql, values, callback) => {
		pool.getConnection((err, connection) => {
			if (err) {
				return callback(err, null)
			}
			console.log('pool.query')

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
					reject(err)
				} else {
					resolve(connection)
				}
			})
		})
	}

	connection.logPrefix = '[' + (connection.threadId || 'default') + '] '
}


// let app = require('express')()
// app.use('*', async (req, res, cb) => {
// 	let connection = await manager.createConnection()

// 	connection.beginTransaction((e) => {
// 		connection.query('insert into test_users SET ?', { user_id: 343 }, async (e, r) => {
// 			if (e) {
// 				console.log(e)
// 				connection.rollback()
// 				return res.status(400).send({ err: e })
// 			}
// 			// connection.commit()
// 			// connection.rollback()
// 			connection.release()
// 			res.send()
// 		})
// 	})
// })
// app.listen(3000)
