const assert = require('assert')
const Event = require('./Logger/Event')
const mysql = require('mysql')
module.exports = class MySQLConnectionPool {
	constructor(options) {
		this._options = options

		this.connectionRequests = []
		this.waiting = []
		this.using = {
			default: {
				12: {}
			}
		}
	}

	count() {
		const waiting = this.waiting.length
		const using = Object.values(this.using)
			.map(o => Object.keys(o).length)
			.reduce((a, b) => { a + b }, 0)

		const total = waiting + using

		return total
	}

	shift() {
		return this.waiting.shift()
	}

	setUsing(mysqlConnection) {
		if (!this.using[mysqlConnection.tag.name]) {
			this.using[mysqlConnection.tag.name] = {}
		}

		if (!this.using[mysqlConnection.tag.name][mysqlConnection.connectionID]) {
			this.using[mysqlConnection.tag.name][mysqlConnection.connectionID] = mysqlConnection
		} else {
			assert.fail(`get ${mysqlConnection.role} duplicated connection`)
		}
	}

	createConnection(option, role, connection) {
		const mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role

		this._decorator(mysqlConnection, connection)

		return mysqlConnection
	}

	_decorator(mysqlConnection, connection) {
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
			delete this.using[mysqlConnection.tag.name][mysqlConnection.connectionID]
			this.waiting.push(mysqlConnection)
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
	}
}
