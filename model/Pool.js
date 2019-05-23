require('./Misc')
const LogLevel = require('./LogLevel')
const defaultOptions = require('./DefaultOptions')
const Connection = require('./Connection')

const { EventEmitter } = require('events')

const extendRedis = require('./RedisExtend')

class Pool {
	constructor({ options, redisClient } = {}) {
		this.options = options || defaultOptions

		this.connectionPool = {
			using: {},
			waiting: []
		}

		this._logger = LogLevel.error
		this.redisClient = redisClient

		this.connectionID = 0

		this._connectionRequests = []

		this.event = new EventEmitter()

		console.log('pool-mysql writer host: ', this.options.writer.host)
		console.log('pool-mysql reader host: ', this.options.reader.host)

		this.runSchedulers()
	}

	runSchedulers() {
		//自動清多餘connection
		setInterval(this._endFreeConnections.bind(this), 5 * 60 * 1000)

		//清掉timeout的get connection requests
		setInterval(() => {
			const now = new Date()
			const requestTimeOut = 10000

			while (this._connectionRequests[0] && now - this._connectionRequests[0].requestTime > requestTimeOut) {
				const callback = this._connectionRequests.shift()
				const err = Error('get connection request timeout')
				callback(err, null)
			}
		}, 1000)
	}

	get numberOfConnections() {
		const amount = Object.keys(this.connectionPool.using).length + this.connectionPool.waiting.length

		if (amount != this._numberOfConnections) {
			this.event.emit('amount', amount)
			this._numberOfConnections = amount
		}

		return amount
	}

	// set numberOfConnections(value) {
	// 	this._numberOfConnections = value
	// }

	get Schema() {
		return require('./Schema')
	}

	get logger() {
		return this._logger
	}

	set logger(string) {
		switch (string) {
			case 'all':
				this._logger = LogLevel.all
				break
			case 'error':
				this._logger = LogLevel.error
				break
			default:
				this._logger = LogLevel.none
				break
		}
	}

	get redisClient() {
		return this._redisClient
	}

	set redisClient(newValue) {
		this._redisClient = newValue
		extendRedis(this._redisClient)
	}

	async createConnection() {
		return new Promise(async (resolve, reject) => {
			this.getConnection((err, connection) => {
				if (err) {
					return reject(err)
				}
				resolve(connection)
			})
		})
	}

	getConnection(callback, retry = 0) {
		try {
			//reuse
			let connection = this.connectionPool.waiting.shift()
			if (connection) {
				this.connectionPool.using[connection.id] = connection
				connection.gotAt = new Date()
				this.event.emit('get', connection)
				return callback(undefined, connection)
			}
			//on connection limit, 去排隊
			else if (this.numberOfConnections >= this.options.connectionLimit) {
				callback.requestTime = new Date()
				this._connectionRequests.push(callback)
				this.event.emit('request')
				return
			}

			//create new one
			this.connectionID++
			connection = new Connection(this)
			this.connectionPool.using[connection.id] = connection

			connection.connect().then(() => {
				this.event.emit('create', connection)
				this.numberOfConnections
				callback(undefined, connection)
			}).catch(err => {
				delete this.connectionPool.using[connection.id]
				callback(err, undefined)
			})
		} catch (error) {
			callback(error, undefined)
		}
	}

	async _recycle(connection) {
		const callback = this._connectionRequests.shift()
		if (callback) {
			this.event.emit('recycle', connection)
			connection.gotAt = new Date()
			return callback(null, connection)
		}

		delete this.connectionPool.using[connection.id]
		this.connectionPool.waiting.push(connection)
		this.event.emit('release', connection)
	}

	query(sql, b, c) {
		this.createConnection().then(connection => {
			const callback = c || b

			const cb = (a, b, c) => {
				this._recycle(connection).then()
				callback(a, b, c)
			}

			if (c) {
				connection.query(sql, b, cb)
			} else {
				connection.query(sql, cb)
			}
		}).catch(c || b)
		return {}
	}

	release() { }

	//結束一半的waiting connections, 至少留10個
	_endFreeConnections() {
		const atLeast = process.env.SQL_FREE_CONNECTIONS || 10
		const stayAmount = Math.ceil(this.connectionPool.waiting.length / 2)

		while (stayAmount > atLeast && this.connectionPool.waiting.length > stayAmount) {
			const connection = this.connectionPool.waiting.shift()
			if (!connection) {
				continue
			}

			this.numberOfConnections
			connection.end()
		}
	}
}

module.exports = new Pool()
