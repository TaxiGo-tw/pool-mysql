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
			await reader.startTransaction()
			await writer.startTransaction()
			cb(undefined)
		} catch (e) {
			cb(e)
		}
	}

	query(sql, values, cb) {
		let connection = this.getConnection(sql)
		let q = connection.query(sql, values, cb)
		console.log('[' + (connection.threadId || 'default') + '] :' + q.sql)
	}

	commit() {
		return new Promise((resolve, reject) => {
			this.reader.commit(() => {
				console.log('commit 1')
				this.writer.commit(() => {
					console.log('commit 2')

					this.reader.release()
					this.writer.release()
					resolve()
				})
			})
		})
	}

	rollback() {
		return new Promise((resolve, reject) => {
			this.reader.rollback(() => {
				console.log('rollback 1')
				this.writer.rollback(() => {
					console.log('rollback 2')

					this.reader.release()
					this.writer.release()
					resolve()
				})
			})
		})
	}

	release() {
		console.log('release')
		this.reader.release()
		this.writer.release()
	}

	getConnection(sql) {
		return (/(SELECT|select)/).test(sql) ? this.reader : this.writer
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
			pool.getConnection(function (err, connection) {
				if (err) {
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
}

let app = require('express')()
app.use('*', async (req, res, cb) => {
	let connection = await manager.createConnection()

	connection.beginTransaction((e) => {
		connection.query('insert into test_users SET ?', { user_id: 343 }, async (e, r) => {
			if (e) {
				console.log(e)
				connection.rollback()
				return res.status(400).send({ err: e })
			}
			// connection.commit()
			// connection.rollback()
			// connection.release()
			res.send()
		})
	})
})
app.listen(3000)

