const assert = require('assert')
const mysql = require('mysql')

const Event = require('./Event')

const MySQLConnectionPool = require('./MySQLConnectionPool')

module.exports = class MySQLConnectionManager {
	constructor(options) {
		this._options = options

		this._writerPool = new MySQLConnectionPool(options.writer)
		this._readerPool = new MySQLConnectionPool(options.reader)
	}

	async _getConnection({ connection, connectionPool, options, role }) {
		const mysqlConnection = connectionPool.shift() || this._createConnection(options, role, connection)

		mysqlConnection.connectionID = connection.id
		mysqlConnection.tag = connection.tag

		connectionPool.setUsing(mysqlConnection)

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

	//////////////////////////////////////////////////////////////

	_connectionPool(mysqlConnection) {
		return mysqlConnection.role == 'Writer' ? this._writerPool : this._readerPool
	}

	_getNextWaitingCallback(connectionPool) {
		const [callback] = this._connectionRequests.filter((callback) => {
			const callback_tag_name = callback.tag.name
			const callback_tag_limit = parseInt(callback.tag.limit, 10)
			const isUnderTagLimit = Object.keys(connectionPool.using[callback_tag_name]).length < callback_tag_limit
			return isUnderTagLimit
		})

		const callback_index = this._connectionRequests.indexOf(callback)
		delete this._connectionRequests[callback_index]

		return callback
	}

	_moveConnectionToCallback({ mysqlConnection, callback }) {
		const connectionPool = this._connectionPool(mysqlConnection)

		delete connectionPool.using[mysqlConnection.tag.name][mysqlConnection.id]
		if (callback) {
			mysqlConnection.tag = callback.tag
			connectionPool.using[callback.tag.name][mysqlConnection.id] = mysqlConnection
		} else {
			delete mysqlConnection.tag
		}
	}

	_recycle(mysqlConnection) {
		const connectionPool = this._connectionPool(mysqlConnection)

		const callback = this._getNextWaitingCallback(connectionPool)

		if (callback) {
			Event.emit('recycle', mysqlConnection)
			mysqlConnection.gotAt = new Date()

			this._moveConnectionToCallback({ connection: mysqlConnection, callback })

			Event.emit('log', undefined, `_recycle ${this.connectionID} ${JSON.stringify(mysqlConnection.tag)}`)
			return callback(null, mysqlConnection)
		}

		this._moveConnectionToCallback({ mysqlConnection })

		mysqlConnection._resetStatus()
		connectionPool.waiting.push(mysqlConnection)
		Event.emit('release', mysqlConnection)
	}

	//////////////////////////////////////////////////////////////

	// mysqlConnection decorator
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
				delete this._writerPool.using[mysqlConnection.tag][mysqlConnection.connectionID]
				this._writerPool.waiting.push(mysqlConnection)
			} else if (mysqlConnection.role == 'Reader') {
				delete this._readerPool.using[mysqlConnection.tag][mysqlConnection.connectionID]
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
