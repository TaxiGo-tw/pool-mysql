const assert = require('assert')
const mysql = require('mysql')

const Event = require('./Event')

module.exports = class MySQLConnectionManager {
	constructor(options) {
		this._options = options

		this._writerPool = {
			waiting: [],
			using: {
				default: {}
			}
		}

		this._readerPool = {
			waiting: [],
			using: {
				default: {}
			}
		}
	}


	async _getConnection({ connection, connectionPool, options, role }) {
		const mysqlConnection = connectionPool.waiting.shift()
			|| this._createConnection(options, role, connection)

		mysqlConnection.connectionID = connection.id

		if (!connectionPool.using[mysqlConnection.connectionID]) {
			connectionPool.using[mysqlConnection.connectionID] = mysqlConnection
		} else {
			assert.fail(`get ${role} duplicated connection`)
		}
		return mysqlConnection
	}

	async getWriter(connection) {
		return await this._getConnection({
			connection,
			connectionPool: this._writerPool,
			options: this._options.writer,
			role: 'Writer'
		})
	}

	async getReader(connection) {
		return await this._getConnection({
			connection,
			connectionPool: this._readerPool,
			options: this._options.reader,
			role: 'Reader'
		})
	}

	// decorator
	_createConnection(option, role, connection) {
		const mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role

		mysqlConnection.on('error', err => {
			Event.emit('log', err, `connection error: ${(err && err.message) ? err.message : err}`)
			connection.end()
		})

		// 向下相容 ex: connection.writer.q()
		// 所以留著不動
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

		mysqlConnection.qV2 = (sql, values) => {
			return new Promise((resolve, reject) => {
				mysqlConnection.query(sql, values, (err, result, fields) => {
					if (err) {
						reject(err)
					} else {
						resolve({ result, fields })
					}
				})
			})
		}

		mysqlConnection.startTransaction = () => {
			return new Promise((resolve, reject) => {
				mysqlConnection.beginTransaction((err) => {
					Event.emit('log', err, `${mysqlConnection.logPrefix} : Start Transaction`)
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
					Event.emit('log', err, `${mysqlConnection.logPrefix} : COMMIT`)
					if (err) {
						reject(err)
					} else {
						resolve(mysqlConnection)
					}
				})
			})
		}

		mysqlConnection.returnToPool = () => {
			if (mysqlConnection.role == 'Writer') {
				// this._writerPool.using.
				this._writerPool.waiting.push(mysqlConnection)
			} else if (mysqlConnection.role == 'Reader') {
				// this._writerPool.using.
				this._readerPool.waiting.push(mysqlConnection)
			}
		}

		mysqlConnection.awaitConnect = () => {
			return new Promise((resolve, reject) => {
				mysqlConnection.connect(err => {
					if (err) {
						Event.emit('log', err)
						return reject(err)
					}

					mysqlConnection.logPrefix = `[${(mysqlConnection.connectionID || 'default')}] ${mysqlConnection.role}`

					resolve(mysqlConnection)
				})
			})
		}

		return mysqlConnection
	}
}
