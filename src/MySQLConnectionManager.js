const assert = require('assert')
const mysql = require('mysql')
const throwError = require('./Helper/throwError')

const Event = require('./Logger/Event')

const MySQLConnectionPool = require('./MySQLConnectionPool')

module.exports = class MySQLConnectionManager {
	constructor(options) {
		this._options = options

		const { writer, reader } = options
		this._writerPool = new MySQLConnectionPool(writer)
		this._readerPool = new MySQLConnectionPool(reader)
	}

	async _getConnection({ connection, options, role }) {
		const mysqlPool = this._connectionPool(role)

		const mysqlConnection = mysqlPool.shift()
			|| await mysqlPool.createConnection(options, role, connection)

		mysqlConnection.tag = connection.tag

		mysqlPool.setUsing(mysqlConnection)

		return mysqlConnection
	}

	async getWriter(connection) {
		return await this._getConnection({
			connection,
			options: this._options.writer,
			role: 'Writer'
		})
	}

	async getReader(connection) {
		return await this._getConnection({
			connection,
			options: this._options.reader,
			role: 'Reader'
		})
	}

	//////////////////////////////////////////////////////////////

	_connectionPool(role) {
		switch (role) {
			case 'Writer':
				return this._writerPool
			case 'Reader':
				return this._readerPool
			default:
				throwError(`Wrong Role: ${role}`)
		}
	}

	_getNextWaitingCallback(connectionPool) {
		const [callback] = connectionPool.connectionRequests.filter((callback) => {
			const callback_tag_name = callback.tag.name
			const callback_tag_limit = parseInt(callback.tag.limit, 10)
			const isUnderTagLimit = Object.keys(connectionPool.using[callback_tag_name]).length < callback_tag_limit
			return isUnderTagLimit
		})

		const callback_index = connectionPool.connectionRequests.indexOf(callback)
		delete connectionPool.connectionRequests[callback_index]

		return callback
	}

	_moveConnectionToCallback({ mysqlConnection, callback }) {
		const connectionPool = this._connectionPool(mysqlConnection.role)

		delete connectionPool.using[mysqlConnection.tag.name][mysqlConnection.id]
		if (callback) {
			mysqlConnection.tag = callback.tag
			connectionPool.using[callback.tag.name][mysqlConnection.id] = mysqlConnection
		} else {
			delete mysqlConnection.tag
		}
	}

	_recycle(mysqlConnection) {
		const connectionPool = this._connectionPool(mysqlConnection.role)

		const callback = this._getNextWaitingCallback(connectionPool)

		if (callback) {
			Event.emit('recycle', mysqlConnection, connectionPool.option.role)
			mysqlConnection.gotAt = new Date()

			this._moveConnectionToCallback({ connection: mysqlConnection, callback })

			Event.emit('log', undefined, `_recycle ${mysqlConnection.connectionID} ${JSON.stringify(mysqlConnection.tag)}`)
			return callback(null, mysqlConnection)
		}

		this._moveConnectionToCallback({ mysqlConnection })

		mysqlConnection._resetStatus()
		connectionPool.waiting.push(mysqlConnection)
		Event.emit('release', mysqlConnection)
	}
}
