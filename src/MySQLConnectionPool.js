const assert = require('assert')
const Event = require('./Logger/Event')
const mysql = require('mysql')
const { promisify } = require('util')
module.exports = class MySQLConnectionPool {
	constructor(option) {
		this.option = option

		this.connectionRequests = []
		this.waiting = []
		this.using = {
			default: {}
		}

		this._connectionID = 0

		this._runSchedulers()
	}

	get _waitingCount() {
		return this.waiting.length
	}

	get _usingCount() {
		return Object.values(this.using)
			.reduce((a, b) => a + Object.keys(b).length, 0)
	}

	get numberOfConnections() {
		const amount = this._waitingCount + this._usingCount

		if (amount != this._numberOfConnections) {
			Event.emit('amount', amount, this.option.role)
			this._numberOfConnections = amount
		}

		return amount
	}

	async createConnection(option, role, connection) {
		return new Promise((resolve, reject) => {
			this._createConnection(option, role, connection, (err, mysqlConnection) => {
				if (err) {
					return reject(err)
				}
				resolve(mysqlConnection)
			})
		})
	}

	/////////////////////////////////

	_createConnection(option, role, connection, callback) {
		const setUsing = (mysqlConnection) => {
			if (!this.using[mysqlConnection.tag.name]) {
				this.using[mysqlConnection.tag.name] = {}
			}

			if (!this.using[mysqlConnection.tag.name][mysqlConnection.connectionID]) {
				this.using[mysqlConnection.tag.name][mysqlConnection.connectionID] = mysqlConnection
			}
		}

		const tag = connection.tag

		let mysqlConnection = this.waiting.shift()

		if (mysqlConnection) {
			mysqlConnection.tag = connection.tag
			setUsing(mysqlConnection)
			return callback(undefined, mysqlConnection)
		}

		const isOnTotalLimit = this.numberOfConnections >= this.option.connectionLimit
		const isOnTagLimit = Object.keys(this.using[tag.name]).length >= tag.limit
		// 排隊
		if (isOnTotalLimit || isOnTagLimit) {
			callback.requestTime = new Date()
			callback.tag = tag
			this.connectionRequests.push(callback)
			Event.emit('request', this.connectionRequests.length, this.option.role)
			return
		}


		mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role
		mysqlConnection.connectionID = this._connectionID++

		mysqlConnection.tag = connection.tag
		this._decorator(mysqlConnection, connection)

		setUsing(mysqlConnection)

		mysqlConnection.connect(err => {
			if (err) {
				Event.emit('log', err)
				return callback(err, undefined)
			}
			mysqlConnection.logPrefix = `[${(mysqlConnection.connectionID || 'default')}] ${mysqlConnection.role}`

			Event.emit('create', mysqlConnection, this.option.role)
			this.numberOfConnections

			return callback(undefined, mysqlConnection)
		})
	}

	////////////////////////////////////////////////////

	_getNextWaitingCallback() {
		const [callback] = this.connectionRequests.filter((callback) => {
			const { name, limit } = callback.tag
			const tagLimit = parseInt(limit, 10)
			const usingCount = Object.keys(this.using[name]).length
			const isUnderTagLimit = usingCount <= tagLimit
			return isUnderTagLimit
		})

		const callback_index = this.connectionRequests.indexOf(callback)
		delete this.connectionRequests[callback_index]

		return callback
	}

	//////////////////////////////////////////////////

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

		mysqlConnection._resetStatus = () => {
			delete mysqlConnection.tag
		}

		mysqlConnection.returnToPool = () => {
			const callback = this._getNextWaitingCallback()

			if (callback) {
				Event.emit('recycle', mysqlConnection)
				mysqlConnection.gotAt = new Date()

				delete this.using[mysqlConnection.tag.name][mysqlConnection.connectionID]
				mysqlConnection.tag = callback.tag
				this.using[mysqlConnection.tag.name][mysqlConnection.connectionID] = mysqlConnection

				Event.emit('log', undefined, `_recycle ${this.connectionID} ${JSON.stringify(mysqlConnection.tag)}`)
				return callback(null, mysqlConnection)
			}

			delete this.using[mysqlConnection.tag.name][mysqlConnection.id]
			delete mysqlConnection.tag

			mysqlConnection._resetStatus()
			this.waiting.push(mysqlConnection)
			Event.emit('release', mysqlConnection)
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

		mysqlConnection.close = () => {
			Event.emit('log', undefined, `[${mysqlConnection.connectionID}] END`)

			mysqlConnection.end()

			// remove from pool

			const index = this.waiting.indexOf(mysqlConnection)
			if (index > -1) {
				this.waiting.splice(index, 1)
			}

			if (mysqlConnection.tag) {
				delete this.using[mysqlConnection.tag.name][mysqlConnection.connectionID]
			}
		}

		mysqlConnection.on('error', function (err) {
			console.log(333, err.code)
		})
	}

	_runSchedulers() {
		//自動清多餘connection
		//結束一半的waiting connections, 至少留10個
		setInterval(() => {
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
		}, 5 * 60 * 1000)

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
