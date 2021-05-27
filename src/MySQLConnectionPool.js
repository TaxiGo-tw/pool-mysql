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

		this.connectionID = 1

		this._runSchedulers()
	}

	identity(mysqlConnection = {}) {
		return `[Pool:${this.option.poolID}] [${this.option.role}:${mysqlConnection.id || ''}]`
	}

	get _waitingCount() {
		return this.waiting.length
	}

	get _usingCount() {
		return Object.values(this.using)
			.reduce((a, b) => a + Object.keys(b).length, 0)
	}

	numberOfConnections(mysqlConnection) {
		const amount = this._waitingCount + this._usingCount

		if (amount != this._numberOfConnections) {
			Event.emit('amount', this.identity(mysqlConnection), amount)
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

		//去排隊
		const enqueue = (tag, callback) => {
			callback.requestTime = new Date()
			callback.tag = tag
			this.connectionRequests.push(callback)
			Event.emit('request', this.identity({ id: '_' }), this.connectionRequests.length)
		}

		const setUsing = (mysqlConnection) => {
			if (!this.using[mysqlConnection.tag.name]) {
				this.using[mysqlConnection.tag.name] = {}
			}

			if (!this.using[mysqlConnection.tag.name][mysqlConnection.id]) {
				this.using[mysqlConnection.tag.name][mysqlConnection.id] = mysqlConnection
			}

			mysqlConnection.gotAt = new Date()
		}

		const tag = connection.tag

		let mysqlConnection = this.waiting.shift()

		// 重用舊的connection
		if (mysqlConnection) {
			mysqlConnection.tag = connection.tag
			setUsing(mysqlConnection)
			return callback(undefined, mysqlConnection)
		}

		const isOnTotalLimit = this.numberOfConnections({ id: '_' }) >= this.option.connectionLimit
		const isOnTagLimit = Object.keys(this.using[tag.name]).length >= tag.limit

		// 排隊
		if (isOnTotalLimit || isOnTagLimit) {
			return enqueue(tag, callback)
		}

		// 產生新的connection
		mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role
		mysqlConnection.id = this.connectionID++

		mysqlConnection.tag = connection.tag
		this._decorator(mysqlConnection, connection)

		setUsing(mysqlConnection)

		mysqlConnection.connect(err => {
			if (err) {
				Event.emit('err', this.identity(mysqlConnection), err)

				switch (true) {
					case err.message.startsWith('ER_CON_COUNT_ERROR: Too many connections'): {
						mysqlConnection.close()
						return enqueue(tag, callback)
					}
					case err.message.includes('PROTOCOL_CONNECTION_LOST'):
					case err.message.startsWith('Error: connect ECONNREFUSED'): {
						mysqlConnection.close()
						return callback(err, undefined)
					} default:
						return callback(err, undefined)
				}
			}

			Event.emit('create', this.identity(mysqlConnection), mysqlConnection)
			this.numberOfConnections(mysqlConnection)

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
			if (err) {
				Event.emit('err', this.identity(mysqlConnection), err)
			}

			connection.end()
		})

		mysqlConnection.q = (sql, values) => {
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

		mysqlConnection.beginTransactionAsync = () => {
			return new Promise((resolve, reject) => {
				mysqlConnection.beginTransaction((err) => {
					if (err) {
						Event.emit('err', this.identity(mysqlConnection) + `Start Transaction`, err)
						reject(err)
					} else {
						Event.emit('log', this.identity(mysqlConnection), `Start Transaction`)

						resolve()
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
				Event.emit('recycle', this.identity(mysqlConnection))
				mysqlConnection.gotAt = new Date()

				delete this.using[mysqlConnection.tag.name][mysqlConnection.id]
				mysqlConnection.tag = callback.tag
				this.using[mysqlConnection.tag.name][mysqlConnection.id] = mysqlConnection

				Event.emit('log', this.identity(mysqlConnection), `RECYCLE ${JSON.stringify(mysqlConnection.tag)}`)
				return callback(null, mysqlConnection)
			}

			Event.emit('log', this.identity(mysqlConnection), `RELEASE ${JSON.stringify(mysqlConnection.tag)}`)
			Event.emit('release', this.identity(mysqlConnection), mysqlConnection)

			delete this.using[mysqlConnection.tag.name][mysqlConnection.id]
			delete mysqlConnection.tag

			mysqlConnection._resetStatus()
			this.waiting.push(mysqlConnection)
		}

		// extends of mysqlConnection.end()
		mysqlConnection.close = () => {
			Event.emit('log', this.identity(mysqlConnection), ` END`)

			mysqlConnection.end()

			// remove from pool

			const index = this.waiting.indexOf(mysqlConnection)
			if (index > -1) {
				this.waiting.splice(index, 1)
			}

			if (mysqlConnection.tag) {
				delete this.using[mysqlConnection.tag.name][mysqlConnection.id]
			}
		}

		mysqlConnection.identity = () => {
			return `Pool:${this.option.poolID} [${this.option.role}:${mysqlConnection.id || ''}] `
		}

		mysqlConnection.commitAsync = async () => {
			if (mysqlConnection.role !== 'Writer') {
				return
			}

			const commitAsync = require('util').promisify(mysqlConnection.commit)
			await commitAsync()
		}
	}

	//////////////////////////////////////

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

				this.numberOfConnections(mysqlConnection)
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

		//health report
		setInterval(() => {
			Object.values(this.using)
				.map(tagged => Object.values(tagged))
				.forEach(mysqlConnection => {
					try {
						const queryTime = new Date() - mysqlConnection.gotAt

						if (queryTime > 3000) {
							Event.emit('warn', this.identity(mysqlConnection), `stroked time:${queryTime}ms, name:${mysqlConnection.name}, sql:${mysqlConnection.querying}`)
						}

						if (queryTime > 1000 * 60 * 30 && !mysqlConnection.querying) {
							Event.emit('warn', this.identity(mysqlConnection), `leaked time:${queryTime}ms, should release it`)
						}
					} catch (error) {
						Event.emit('err', this.identity(mysqlConnection), error)
					}
				})
		}, 10 * 1000)
	}
}
