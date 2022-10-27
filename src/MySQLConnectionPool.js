const Event = require('./Logger/Event')
const mysql = require('mysql')
const throwError = require('./Helper/throwError')

module.exports = class MySQLConnectionPool {
	constructor(option) {
		this.option = option

		this.connectionRequests = []
		this.waiting = []
		this.using = {}

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

			if (this.using[mysqlConnection.tag.name][mysqlConnection.id]) {
				const anotherConnection = this.using[mysqlConnection.tag.name][mysqlConnection.id]
				throwError(anotherConnection.identity() + ' is using')
			} else {
				this.using[mysqlConnection.tag.name][mysqlConnection.id] = mysqlConnection
			}

			mysqlConnection.gotAt = new Date()

			Event.emit('get', this.identity(mysqlConnection), mysqlConnection)
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
		const isOnTagLimit = Object.keys(this.using[tag.name] || {}).length >= tag.limit

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
				Event.emit('err', `${this.identity(mysqlConnection)}: ${err.message}`, err)

				switch (true) {
					case err.message.startsWith('ER_CON_COUNT_ERROR: Too many connections'): {
						mysqlConnection.close()
						return enqueue(tag, callback)
					}
					case err.message.includes('PROTOCOL_CONNECTION_LOST'):
					case err.message.includes('PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'):
					case err.message.includes('ER_CON_COUNT_ERROR'):
					case err.message.includes('Connection lost: The server closed the connection.'):
					case err.message.includes('Cannot enqueue Query after fatal error'):			
					case err.message.includes('Error: connect ECONNREFUSED'):
					default:
						mysqlConnection.close()
						return callback(err, undefined)
				}
			}

			this.numberOfConnections(mysqlConnection)

			Event.emit('did_create', this.identity(mysqlConnection), mysqlConnection)
			return callback(undefined, mysqlConnection)
		})
	}



	////////////////////////////////////////////////////

	_getNextWaitingCallback() {
		const { distinct } = require('./Helper/array')

		//不重複tag的callbacks
		const distinctTagNameRequests = distinct(this.connectionRequests, requestCallback => requestCallback.tag.name)

		const callback = distinctTagNameRequests
			/* 排序tag name小的優先 */
			.sort((a, b) => parseInt(a.tag.name) - parseInt(b.tag.name))
			/* 首個未到limit的callback */
			.find(callback => {
				if (!callback) {
					return false
				}

				const { name, limit } = callback.tag
				const usingCount = Object.keys(this.using[name] || {}).length
				return usingCount <= limit
			})

		if (!callback) {
			return
		}

		const callback_index = this.connectionRequests.indexOf(callback)
		this.connectionRequests.splice(callback_index, 1)

		return callback
	}

	//////////////////////////////////////////////////

	_decorator(mysqlConnection, connection) {
		mysqlConnection.on('error', err => {
			if (err) {
				if (mysqlConnection.tag) { //using
					Event.emit('err', `${this.identity(mysqlConnection)}: ${err.message}`, err)
				} else {
					Event.emit('warn', `${this.identity(mysqlConnection)}: ${err.message}`, err)
				}
			}

			mysqlConnection.close()
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
				Event.emit('recycle', this.identity(mysqlConnection), mysqlConnection)
				mysqlConnection.gotAt = new Date()

				delete this.using[mysqlConnection.tag.name][mysqlConnection.id]
				mysqlConnection.tag = callback.tag

				if (!this.using[mysqlConnection.tag.name]) {
					this.using[mysqlConnection.tag.name] = {}
				}
				this.using[mysqlConnection.tag.name][mysqlConnection.id] = mysqlConnection

				Event.emit('log', this.identity(mysqlConnection), `RECYCLE ${JSON.stringify(mysqlConnection.tag)}`)
				return callback(null, mysqlConnection)
			}

			if (!mysqlConnection.tag) {
				Event.emit('warn', this.identity(mysqlConnection), `shouldn't to here, maybe release twice`)
				return
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
			return new Promise((resolve, reject) => {
				if (mysqlConnection.role !== 'Writer') {
					return resolve()
				}

				mysqlConnection.commit((err) => {
					if (err) {
						return reject(err)
					}

					resolve()
				})
			})
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
				mysqlConnection.close()
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
				.reduce((array, mysqlConnections) => array.concat(mysqlConnections), [])
				.forEach(mysqlConnection => {
					try {
						const queryTime = new Date() - mysqlConnection.gotAt

						if (queryTime <= 3000) {
							return // 還沒很久
						} else if (mysqlConnection.querying) {
							Event.emit('warn', this.identity(mysqlConnection), `Stroked time:${queryTime}ms, querying:${mysqlConnection.querying}`)
						} else if (mysqlConnection.last_query) {
							Event.emit('warn', this.identity(mysqlConnection), `Leaked time:${queryTime}ms, should release it. last_query: ${mysqlConnection.last_query}`)
						} else {
							Event.emit('warn', this.identity(mysqlConnection), `Leaked time:${queryTime}ms, connection not used,should release it`)
						}
					} catch (error) {
						Event.emit('err', this.identity(mysqlConnection), error)
					}
				})
		}, 10 * 1000)
	}
}
