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

function getConnection(sql) {
	// console.log(this.reader)
	// console.log(this.writer)

	if (sql.match(/(SELECT|select)/)) {
		return this.reader
	}

	return this.writer
}

function query(sql, values, cb) {
	console.log('1')
	// if (callback) {
	// 	console.log('2')
	// } else {
	// 	console.log('3')
	// 	cb = values
	// 	values = undefined
	// }
	console.log(this.getConnection(sql))
	// getConnection(sql).query(sql, cb)
	// console.log(query.sql)

}

//manager
let manager = {
	createConnection: () => {
		return new Promise(async (resolve, reject) => {
			try {
				let reader = await readerPool.createConnection()
				setConnection(reader)
				let writer = await writerPool.createConnection()
				setConnection(writer)

				resolve({
					reader: reader,
					writer: writer,
					startTransaction: async (err, cb) => {
						try {
							await reader.startTransaction()
							await writer.startTransaction()
							cb(undefined)
						} catch (e) {
							cb(e)
						}
					},
					query: query,
					commit: () => {
						reader.commit()
						writer.commit()
					},
					rollback: () => {
						reader.rollback()
						writer.rollback()
					},
					release: () => {
						reader.release()
						writer.release()
					},
					getConnection: getConnection
				})
			} catch (e) {
				reject(e)
			}
		})
	}
}
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
		// console.log(r[0])

		m.release()
	})
}

a()

