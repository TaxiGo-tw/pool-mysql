require('./Helper/Misc')
const crypto = require('crypto')
const logger = require('./Logger/Logger')
const LogLevel = require('./Logger/LogLevel')
const Event = require('./Logger/Event')

const MySQLConnectionManager = require('./MySQLConnectionManager')
const Connection = require('./Connection')

const extendRedis = require('./Extension/RedisExtend')
const Combine = require('./Schema/Combine')
const throwError = require('./Helper/throwError')

let poolID = 0

const redisClientIDs = new WeakMap()
let redisClientID = 0

/* 同一個 redisClient 物件拿同一個編號，不同物件視為不同 pool */
function redisIdentity(redisClient) {
	if (!redisClient || typeof redisClient !== 'object') {
		return null
	}

	if (!redisClientIDs.has(redisClient)) {
		redisClientIDs.set(redisClient, ++redisClientID)
	}

	return redisClientIDs.get(redisClient)
}

/* key 排序後遞迴序列化；poolID／role 是每個 pool 自己的編號不算設定，密碼類欄位只放 hash */
function canonical(value, name) {
	if (['password', 'DATA_ENCRYPTION_KEY', 'DATA_ENCRYPTION_IV'].includes(name) && value !== undefined && value !== null) {
		return crypto.createHash('sha256').update(String(value)).digest('hex')
	}

	if (Buffer.isBuffer(value)) {
		return crypto.createHash('sha256').update(value).digest('hex')
	}

	if (Array.isArray(value)) {
		return value.map(item => canonical(item))
	}

	if (value && typeof value === 'object') {
		return Object.keys(value)
			.filter(key => !['poolID', 'role'].includes(key))
			.sort()
			.reduce((result, key) => Object.assign(result, { [key]: canonical(value[key], key) }), {})
	}

	return value
}

/* pool 的識別＝完整正規化後的設定＋redisClient；少任何一項就會讓同主機不同 DB／帳號／port 共用同一個 pool */
function poolKey(options, redisClient) {
	return JSON.stringify(canonical(Object.assign({}, options, { redisClient: redisIdentity(redisClient) })))
}

class Pool {

	/* for create second or more pool */
	createPool({ options: op = {}, redisClient }) {
		if (!op.writer) {
			throw Error('option.writer missing')
		} else if (!op.forceWriter && !op.reader) {
			throw Error('need forceWriter or reader option')
		}

		const options = require('./Options')(op)

		const key = poolKey(options, redisClient)

		if (instance._pools[key]) {
			return instance._pools[key]
		}

		const pool = new Pool({ options, redisClient, id: ++poolID })
		instance._pools[key] = pool
		return pool
	}

	constructor({ options, redisClient, id } = {}) {
		this.id = id

		this.options = require('./Options')(options, id)

		this._mysqlConnectionManager = new MySQLConnectionManager(this.options)

		this.redisClient = redisClient

		Event.emit('warn', this.identity(), `pool-mysql writer host: ${this.options.writer.host}`)
		Event.emit('warn', this.identity(), `pool-mysql reader host: ${this.options.reader.host}`)

		this.Schema = require('./Schema')

		this._pools = {}

		this.combine = new Combine()
	}

	identity() {
		return `Pool:${this.options.poolID} `
	}

	/* Redis cache 的穩定命名空間＝pool 的 DB 身分（writer host/port/database/user）雜湊。
	   多個邏輯 pool 共用同一 Redis 時，用來隔離 auto key（SQL 字串）避免跨 pool/DB 撞到彼此快取（CWE-524）。
	   以 DB 身分（非 runtime poolID）為基底，確保跨 process／重啟一致、同 DB 的 pool 仍共用快取。 */
	get cacheNamespace() {
		if (this._cacheNamespace === undefined) {
			const w = this.options.writer || {}
			const identity = `${w.host}:${w.port}:${w.database}:${w.user}`
			this._cacheNamespace = `pm:${crypto.createHash('sha1').update(identity).digest('hex').slice(0, 12)}:`
		}
		return this._cacheNamespace
	}

	/**
	 * 決定 Redis cache 實際使用的 key。
	 * auto key（呼叫端沒給 key，用 SQL 字串）自動加 pool+DB 命名空間，避免跨 pool/DB 撞快取；
	 * 呼叫端自帶的 custom key 維持原樣（呼叫端契約，常與 pool-mysql 外部的 Redis 存取共用同一 key）。
	 * @param {string | undefined} customKey
	 * @param {string} queryString
	 * @returns {string}
	 */
	redisCacheKey(customKey, queryString) {
		if (customKey) {
			return customKey
		}
		return this.cacheNamespace + queryString
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
	async createConnection({ limit = this.options.connectionLimit } = {}) {
		return this.connection({ limit })
	}

	connection({ priority = 5, limit = this.options.connectionLimit } = {}) {
		if (isNaN(priority) || isNaN(limit)) {
			throwError('priority or limit should be a number')
		}

		const connection = new Connection(this)
		connection.tag = { name: priority, limit: parseInt(limit) }

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
