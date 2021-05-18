const assert = require('assert')
const Event = require('./Logger/Event')
const mysql = require('mysql')
module.exports = class MySQLConnectionPool {
	constructor(option) {
		this.option = option

		this.connectionRequests = []
		this.waiting = []
		this.using = {
			default: {}
		}

		this._connectionID = 0
	}

	get numberOfConnections() {
		const usingCount = Object.keys(this.using)
			.map(o => Object.keys(o).length)
			.reduce((a, b) => a + b, 0)

		const waitingCount = this.waiting.length
		const amount = usingCount + waitingCount

		if (amount != this._numberOfConnections) {
			Event.emit('amount', amount, this.option.role)
			this._numberOfConnections = amount
		}

		return amount
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

	async createConnection(option, role, connection) {
		const mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role
		mysqlConnection.connectionID = this._connectionID++

		this._decorator(mysqlConnection, connection)

		await mysqlConnection.awaitConnect()

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

	//結束一半的waiting connections, 至少留10個
	_endFreeConnections() {
		const atLeast = this.option.SQL_FREE_CONNECTIONS || 10
		const stayAmount = Math.ceil(this.waiting.length / 2)

		while (stayAmount > atLeast && this.waiting.length > stayAmount) {
			const mysqlConnection = this.waiting.shift()
			if (!mysqlConnection) {
				continue
			}

			this.numberOfConnections
			mysqlConnection.end()
		}
	}

	_runSchedulers() {
		//自動清多餘connection
		setInterval(this._endFreeConnections.bind(this), 5 * 60 * 1000)

		//清掉timeout的get connection requests
		setInterval(() => {
			const now = new Date()
			const requestTimeOut = 10000

			while (this.connectionRequests[0] && now - this.connectionRequests[0].requestTime > requestTimeOut) {
				const callback = this.connectionRequests.shift()
				const err = Error('get connection request timeout')
				callback(err, null)
			}
		}, 1000)
	}
}
