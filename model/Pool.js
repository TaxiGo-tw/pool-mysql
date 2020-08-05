require('./Misc')
const LogLevel = require('./LogLevel')
const defaultOptions = require('./DefaultOptions')
const Connection = require('./Connection')

const Event = require('./Event')

const extendRedis = require('./RedisExtend')

class Pool {
	constructor({ options, redisClient } = {}) {
		this.options = options || defaultOptions

		this.connectionPool = {
			using: {
				default: {}
			},
			waiting: []
		}

		this._logger = LogLevel.error
		this.redisClient = redisClient

		this.connectionID = 0

		this._connectionRequests = []

		this.logger(undefined, `pool-mysql writer host: ${this.options.writer.host}`)
		this.logger(undefined, `pool-mysql reader host: ${this.options.reader.host}`)

		this._runSchedulers()

		this.Schema = require('./Schema')
	}

	get event() {
		return Event
	}

	get numberOfConnections() {
		let count = 0

		Object.keys(this.connectionPool.using).map(key => {
			count = + Object.keys(this.connectionPool.using[key]).length
		})

		const amount = count + this.connectionPool.waiting.length

		if (amount != this._numberOfConnections) {
			Event.emit('amount', amount)
			this._numberOfConnections = amount
		}

		return amount
	}

	get Encryption() {
		return require('./Encryption')
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

	//TODO: { tag, limit = 0 } = {}
	async createConnection({ tag_name = 'default', limit = this.options.connectionLimit } = {}) {
		return new Promise(async (resolve, reject) => {
			this.getConnection((err, connection) => {
				if (err) {
					return reject(err)
				}
				resolve(connection)
			}, tag_name, limit)
		})
	}

	getConnection(callback, tag_name = 'default', limit) {
		try {
			let tag = {
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
				this.numberOfConnections >= this.options.connectionLimit ||
				Object.keys(this.connectionPool.using[tag.name]).length >= limit
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

			connection.connect().then(() => {
				Event.emit('create', connection)
				this.numberOfConnections
				callback(undefined, connection)
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
		}).catch(c || b)
		return {}
	}

	release() { }

	async _recycle(connection) {
		for (const callback of this._connectionRequests) {
			if (Object.keys(this.connectionPool.using[callback.tag.name]).length < callback.tag.limit) {
				Event.emit('recycle', connection)
				this._connectionRequests.splice(this._connectionRequests.indexOf(callback), 1)
				connection.gotAt = new Date()
				connection.tag = callback.tag
				return callback(null, connection)
			}
		}

		delete this.connectionPool.using[connection.tag.name][connection.id]
		delete connection.tag

		connection._resetStatus()
		this.connectionPool.waiting.push(connection)
		Event.emit('release', connection)
	}

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

module.exports = new Pool()
