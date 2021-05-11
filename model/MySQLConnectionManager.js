const mysql = require('mysql')

module.exports = class MySQLConnectionManager {
	constructor(options) {

		this._options = options

		this._writerPool = { waiting: [], using: [] }
		this._readerPool = { waiting: [], using: [] }
	}

	async getWriter(connection) {
		const mysqlConnection = this._writerPool.waiting.shift()
			|| this._createConnection(this._options.writer, 'Writer', connection)

		this._writerPool.using.push(mysqlConnection)

		return mysqlConnection
	}

	async getReader(connection) {
		const mysqlConnection = this._readerPool.waiting.shift()
			|| this._createConnection(this._options.reader, 'Reader', connection)

		this._readerPool.using.push(mysqlConnection)

		return mysqlConnection
	}

	//
	_createConnection(option, role, connection) {
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

		mysqlConnection.return = () => {
			this.waiting.push(mysqlConnection)
		}

		return mysqlConnection
	}
}
