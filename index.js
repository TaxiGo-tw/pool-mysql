var mysql = require('mysql');

const options = {
	connectionLimit: process.env.CONNECTION_LIMIT || 50,
	host: process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD || '123',
	database: process.env.SQL_TABLE || 'test',
	multipleStatements: true,
}

const readerPool = mysql.createPool(options)
setPool(readerPool)
const writerPool = mysql.createPool(options);
setPool(writerPool)

class Manager {
	constructor(reader, writer) {
		this.reader = reader
		this.writer = writer
	}

	async startTransaction(err, cb) {
		try {
			await reader.startTransaction()
			await writer.startTransaction()
			cb(undefined)
		} catch (e) {
			cb(e)
		}
	}
	query(sql, values, cb) {
		this.getConnection(sql).query(sql, values, cb)
	}
	commit() {
		this.reader.commit()
		this.writer.commit()
	}
	rollback() {
		this.reader.rollback()
		this.writer.rollback()
	}
	release() {
		this.reader.release()
		this.writer.release()
	}

	getConnection(sql) {
		return (/(SELECT|select)/).test(sql) ? this.reader : this.writer

		if (sql.match(/(SELECT|select)/)) {
			return this.reader
		}
		return this.writer
	}
}

//manager

class kerkerPool {
	constructor() {

	}

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
}

manager = new kerkerPool()
module.exports = manager

function setPool(pool) {
	pool.createConnection = () => {
		return new Promise((resolve, reject) => {
			pool.getConnection(function (err, connection) {
				if (err) { // return reject(err)
					console.log(err)
				}

				setConnection(connection)
				resolve(connection)
			})
		})
	}

	pool.query = (sql, values, callback) => {
		pool.getConnection((err, connection) => {
			if (callback) {
				//
			} else {
				callback = values
				values = undefined
			}

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
			if (values) {
				connection.query(sql, values, (err, result) => {
					if (err) {
						reject(err)
					} else {
						resolve(result)
					}
				})
			} else {
				connection.query(sql, (err, result) => {
					if (err) {
						reject(err)
					} else {
						resolve(result)
					}
				})
			}
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

async function a() {
	let m = await manager.createConnection()
	m.query('select * from user_info', (e, r) => {
		console.log(r[0])

		m.release()
	})
}

a()

