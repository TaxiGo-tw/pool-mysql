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

	async _getMysqlConnection({ connection, options, role }) {
		return await this
			._connectionPool(role)
			.createConnection(options, role, connection)
	}

	async getWriter(connection) {
		return await this._getMysqlConnection({
			connection,
			options: this._options.writer,
			role: 'Writer'
		})
	}

	async getReader(connection) {
		return await this._getMysqlConnection({
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
}
