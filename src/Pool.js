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

		this.connectionID = 1

		this._connectionRequests = []

		Event.emit('log', undefined, `pool-mysql writer host: ${this.options.writer.host}`)
		Event.emit('log', undefined, `pool-mysql reader host: ${this.options.reader.host}`)

		this.Schema = require('./Schema')
	}

	get event() {
		return Event
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

	/**
	* @deprecated use `connection()`
	*/
	getConnection(cb) {
		const connection = this.connection()
		cb(undefined, connection)
	}

	/**
		* @deprecated use `connection()`
		*/
	async createConnection({ tag_name = 'default', limit = this.options.connectionLimit } = {}) {
		const tag = { name: tag_name, limit: limit }

		const connection = new Connection(this)
		connection.tag = tag
		connection.id = ++this.connectionID

		return connection
	}

	connection({ tag_name = 'default', limit = this.options.connectionLimit } = {}) {
		const tag = { name: tag_name, limit: limit }

		const connection = new Connection(this)
		connection.tag = tag
		connection.id = ++this.connectionID

		return connection
	}

	/**
	* @deprecated use `connection()`
	*/
	query(sql, b, c) {
		const connection = this.connection()
		const callback = c || b

		if (c) {
			connection.query(sql, b, (...args) => {
				callback(...args)
				connection.release()
			})
		} else {
			connection.query(sql, (...args) => {
				callback(...args)
				connection.release()
			})
		}

		return {}
	}

	/**
	* @deprecated use `connection()`
	*/
	release() { }
}


const instance = new Pool({ id: ++poolID })
module.exports = instance
