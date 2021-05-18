require('./Helper/Misc')
const logger = require('./Logger/Logger')
const LogLevel = require('./Logger/LogLevel')
const Event = require('./Logger/Event')

const MySQLConnectionManager = require('./MySQLConnectionManager')
const Connection = require('./Connection')

const extendRedis = require('./Extension/RedisExtend')

let poolID = 0

class Pool {

	/* for create second or more pool */
	createPool({ options = {}, redisClient }) {
		if (!options.writer) {
			throw Error('need options')
		}

		if (!instance._pools) {
			instance._pools = {}
		}

		const key = options.writer.host + options.reader.host + options.database

		if (instance._pools[key]) {
			return instance._pools[key]
		} else {
			const pool = new Pool({ options, redisClient, id: ++poolID })
			instance._pools[key] = pool
			return pool
		}
	}

	constructor({ options, redisClient, id } = {}) {
		this.id = id

		this.options = require('./Options')(options)

		this._mysqlConnectionManager = new MySQLConnectionManager(this.options)

		this.connectionPool = {
			using: {
				default: {}
			},
			waiting: []
		}

		this.redisClient = redisClient

		this.connectionID = 0

		this._connectionRequests = []

		Event.emit('log', undefined, `pool-mysql writer host: ${this.options.writer.host}`)
		Event.emit('log', undefined, `pool-mysql reader host: ${this.options.reader.host}`)

		this._runSchedulers()

		this.Schema = require('./Schema')
	}

	get event() {
		return Event
	}

	get numberOfConnections() {

		const usingCount = Object.keys(this.connectionPool.using).reduce((count, key) => count + Object.keys(this.connectionPool.using[key]).length, 0)

		const waitingCount = this.connectionPool.waiting.length
		const amount = usingCount + waitingCount

		if (amount != this._numberOfConnections) {
			Event.emit('amount', amount)
			this._numberOfConnections = amount
		}

		return amount
	}

	get Encryption() {
		return require('./Schema/Encryption')
	}

	get logger() {
		return logger.current()
	}

	set logger(string) {
		switch (string) {
			case 'all':
				logger.set(LogLevel.all)
				break
			case 'error':
				logger.set(LogLevel.error)
				break
			default:
				logger.set(LogLevel.none)
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

	get mock() {
		return this._mock
	}

	set mock(callback) {
		this._mockCounter = 0
		this._mock = callback
	}

	async createConnection({ tag_name = 'default', limit = this.options.connectionLimit } = {}) {
		return new Promise(async (resolve, reject) => {
			this.getConnection((err, connection) => {
				if (err) {
					return reject(err)
				}
				resolve(connection)
			}, { tag_name, limit })
		})
	}

	getConnection(callback, { tag_name = 'default', limit = this.options.connectionLimit } = { tag_name: 'default', limit: this.options.connectionLimit }) {
		try {
			const tag = {
				name: tag_name,
				limit: limit
			}

			if (!this.connectionPool.using[tag.name]) {
				this.connectionPool.using[tag.name] = {}
			}

			//reuse
			let connection = this.connectionPool.waiting.shift()
			if (connection) {
				connection.tag = tag
				this.connectionPool.using[tag.name][connection.id] = connection
				connection.gotAt = new Date()
				Event.emit('get', connection)
				return callback(undefined, connection)
			}

			//on connection limit, 去排隊
			if (
				this.numberOfConnections >= this.options.connectionLimit
				|| Object.keys(this.connectionPool.using[tag.name]).length >= limit
			) {
				callback.requestTime = new Date()
				callback.tag = tag
				this._connectionRequests.push(callback)
				Event.emit('request', this._connectionRequests.length)
				return
			}


			//create new one
			this.connectionID++
			connection = new Connection(this)
			connection.tag = tag
			this.connectionPool.using[tag.name][connection.id] = connection

			connection.toConnect().then(() => {
				Event.emit('create', connection)
				this.numberOfConnections
				return callback(undefined, connection)
			}).catch(err => {
				delete this.connectionPool.using[tag.name][connection.id]
				delete connection.tag

				callback(err, undefined)
			})
		} catch (error) {
			callback(error, undefined)
		}
	}

	query(sql, b, c) {
		this.createConnection().then(connection => {
			const callback = c || b

			const cb = (a, b, c) => {
				this._recycle(connection)
				callback(a, b, c)
			}

			if (c) {
				connection.query(sql, b, cb)
			} else {
				connection.query(sql, cb)
			}
			return
		}).catch(c || b)
		return {}
	}

	release() { }

	_getNextWaitingCallback() {
		const [callback] = this._connectionRequests.filter((callback) => {
			const callback_tag_name = callback.tag.name
			const callback_tag_limit = parseInt(callback.tag.limit, 10)
			const isUnderTagLimit = Object.keys(this.connectionPool.using[callback_tag_name]).length < callback_tag_limit
			return isUnderTagLimit
		})

		const callback_index = this._connectionRequests.indexOf(callback)
		delete this._connectionRequests[callback_index]

		return callback
	}

	_moveConnectionToCallback({ connection, callback }) {
		delete this.connectionPool.using[connection.tag.name][connection.id]
		if (callback) {
			connection.tag = callback.tag
			this.connectionPool.using[callback.tag.name][connection.id] = connection
		} else {
			delete connection.tag
		}
	}

	_recycle(connection) {
		const callback = this._getNextWaitingCallback()

		if (callback) {
			Event.emit('recycle', connection)
			connection.gotAt = new Date()

			this._moveConnectionToCallback({ connection, callback })

			Event.emit('log', undefined, `_recycle ${this.connectionID} ${JSON.stringify(connection.tag)}`)
			return callback(null, connection)
		}

		this._moveConnectionToCallback({ connection })

		connection._resetStatus()
		this.connectionPool.waiting.push(connection)
		Event.emit('release', connection)
	}

	//結束一半的waiting connections, 至少留10個
	_endFreeConnections() {
		const atLeast = this.options.SQL_FREE_CONNECTIONS || 10
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


	_runSchedulers() {
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
}


const instance = new Pool({ id: ++poolID })
module.exports = instance
