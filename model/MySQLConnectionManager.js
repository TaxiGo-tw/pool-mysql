const promisify = require('util').promisify

const mysql = require('mysql')

// the real pool

module.exports = class MySQLConnectionManager {
	constructor(options) {
		this._options = options

		this._writerPool = {
			waiting: [],
			using: []
		}

		this._readerPool = {
			waiting: [],
			using: []
		}
	}

	async getWriter() {
		const mysqlConnection = this._writerPool.waiting.shift()
			|| MySQLConnectionManager.createConnection(this._options.writer, 'Writer')

		this._writerPool.using.push(mysqlConnection)

		return mysqlConnection
	}

	async getRider() {
		const mysqlConnection = this._readerPool.waiting.shift()
			|| MySQLConnectionManager.createConnection(this._options.reader, 'Reader')

		this._readerPool.using.push(mysqlConnection)

		return mysqlConnection
	}



	//
	static createConnection(option, role) {
		const mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role

		mysqlConnection.on('error', err => {
			this._pool.logger(err, `connection error: ${(err && err.message) ? err.message : err}`)
			throw err
		})

		mysqlConnection.q = promisify(mysqlConnection.query)
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
