const mysql = require('mysql')

// the real pool

module.exports = class ConnectionManager {
	constructor(options) {
		this._options = options
		this._writers = []
		this._readers = []
	}

	async getWriter() {
		let conn = this._writers.shift()
		if (!conn) {
			conn = 1
		}
		return conn
	}

	async getRider() {
		let conn = this._readers.shift()
		if (!conn) {
			conn = 1
		}
		return conn
	}


	//
	_mysqlConnection(option, role, connection) {
		const mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role

		mysqlConnection.on('error', err => {
			this._pool.logger(err, `connection error: ${(err && err.message) ? err.message : err}`)
			//丟掉這個connection
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
