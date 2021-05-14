const assert = require('assert')
const mysql = require('mysql')

module.exports = class MySQLConnectionManager {
	constructor(options) {

		this._options = options

		this._writerPool = { waiting: [], using: {} }
		this._readerPool = { waiting: [], using: {} }
	}

	async getWriter(connection) {
		const mysqlConnection = this._writerPool.waiting.shift()
			|| this._createConnection(this._options.writer, 'Writer', connection)

		mysqlConnection.connectionID = connection.id

		if (!this._writerPool.using[mysqlConnection.connectionID]) {
			this._writerPool.using[mysqlConnection.connectionID] = mysqlConnection
		} else {
			assert.fail('getWriter duplicated connection')
		}

		return mysqlConnection
	}

	async getReader(connection) {
		const mysqlConnection = this._readerPool.waiting.shift()
			|| this._createConnection(this._options.reader, 'Reader', connection)

		mysqlConnection.connectionID = connection.id

		if (!this._readerPool.using[mysqlConnection.connectionID]) {
			this._readerPool.using[mysqlConnection.connectionID] = mysqlConnection
		} else {
			assert.fail('getReader duplicated connection')
		}

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
			if (mysqlConnection.role == 'writer') {
				// this._writerPool.using.
				this._writerPool.waiting.push(mysqlConnection)
			} else if (mysqlConnection.role == 'reader') {
				// this._writerPool.using.
				this._writerPool.reader.push(mysqlConnection)
			}
		}

		mysqlConnection.awaitConnect = () => {
			return new Promise((resolve, reject) => {
				mysqlConnection.connect(err => {
					if (err) {
						this._pool.logger(err)
						return reject(err)
					}

					mysqlConnection.logPrefix = `[${(this.id || 'default')}] ${mysqlConnection.role}`

					resolve(mysqlConnection)
				})
			})
		}

		return mysqlConnection
	}
}
