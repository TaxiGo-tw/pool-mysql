const mysql = require('mysql')

// the real pool

module.exports = class MySQLConnectionManager {
	constructor(options) {

		this._options = options

		this._writerPool = { waiting: [], using: [] }
		this._readerPool = { waiting: [], using: [] }
	}

	getWriter(connection) {
		// if (this._writerPool.waiting.length > this._options.writer.connectionLimit) {

		// }


		const mysqlConnection = this._writerPool.waiting.shift()
			|| MySQLConnectionManager._createConnection(this._options.writer, 'Writer', connection)

		this._writerPool.using.push(mysqlConnection)

		return mysqlConnection
	}

	getReader(connection) {
		const mysqlConnection = this._readerPool.waiting.shift()
			|| MySQLConnectionManager._createConnection(this._options.reader, 'Reader', connection)

		this._readerPool.using.push(mysqlConnection)

		return mysqlConnection
	}

	//
	static _createConnection(option, role, connection) {
		const mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role

		mysqlConnection.on('error', err => {
			this._pool.logger(err, `connection error: ${(err && err.message) ? err.message : err}`)
			connection.end()
		})

		mysqlConnection.q = (sql, values) => {
			return new Promise((resolve, reject) => {
				mysqlConnection.query(sql, values, (err, result) => {
					if (err) {
						reject(err)
					} else {
						resolve(result)
					}
				})
			})
		}

		mysqlConnection.startTransaction = () => {
			return new Promise((resolve, reject) => {
				mysqlConnection.beginTransaction((err) => {
					this._pool.logger(err, `${mysqlConnection.logPrefix} : Start Transaction`)
					if (err) {
						reject(err)
					} else {
						resolve(mysqlConnection)
					}
				})
			})
		}

		mysqlConnection.commitChange = () => {
			return new Promise((resolve, reject) => {
				mysqlConnection.commit((err) => {
					this._pool.logger(err, `${mysqlConnection.logPrefix} : COMMIT`)
					if (err) {
						reject(err)
					} else {
						resolve(mysqlConnection)
					}
				})
			})
		}

		return mysqlConnection
	}
}
