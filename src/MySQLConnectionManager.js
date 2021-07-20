const throwError = require('./Helper/throwError')

const MySQLConnectionPool = require('./MySQLConnectionPool')

module.exports = class MySQLConnectionManager {
	constructor(options) {
		this._options = options

		const { writer, reader } = options
		this._writerPool = new MySQLConnectionPool(writer)
		this._readerPool = new MySQLConnectionPool(reader)
	}

	async getWriter(connection) {
		return await this._getMysqlConnection({
			options: this._options.writer,
			role: 'Writer',
			connection
		})
	}

	async getReader(connection) {
		return await this._getMysqlConnection({
			options: this._options.reader,
			role: 'Reader',
			connection
		})
	}

	//////////////////////////////////////////////////////////////

	async _getMysqlConnection({ options, role, connection }) {
		return await this
			._connectionPool(role)
			.createConnection(options, role, connection)
	}

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
