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

		this.options = this.genOptionsFrom(options, id)

		this._mysqlConnectionManager = new MySQLConnectionManager(this.options)

		this.connectionPool = {
			using: {
				default: {}
			},
			waiting: []
		}

		this.redisClient = redisClient

		this._connectionRequests = []

		Event.emit('warn', this.identity(), `pool-mysql writer host: ${this.options.writer.host}`)
		Event.emit('warn', this.identity(), `pool-mysql reader host: ${this.options.reader.host}`)

		this.Schema = require('./Schema')
	}

	genOptionsFrom(options) {
		return require('./Options')(options)
	}

	identity() {
		return `Pool:${this.options.poolID} `
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

	get mockable() {
		return process.env.NODE_ENV !== 'production' && this.mock && !isNaN(this._mockCounter)
	}

	get mock() {
		return this._mock
	}

	set mock(callback) {
		this._mockCounter = 0
		this._mock = callback
	}

	/**
	* @deprecated use `connection()` for [Function]
	*/
	getConnection(cb) {
		const connection = this.connection()
		cb(undefined, connection)
	}

	/**
		* @deprecated use `connection()` for [Function]
		*/
	async createConnection({ tag_name = 'default', limit = this.options.connectionLimit } = {}) {
		return this.connection({ tag_name, limit })
	}

	connection({ tag_name = 'default', limit = this.options.connectionLimit } = {}) {
		const tag = { name: tag_name, limit }

		const connection = new Connection(this)
		connection.tag = tag

		return connection
	}

	/**
	* @deprecated use `connection()` for [Function]
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
	* @deprecated use `not really do anything`
	*/
	release() { }
}


const instance = new Pool({ id: ++poolID })
module.exports = instance
