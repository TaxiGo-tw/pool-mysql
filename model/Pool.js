const launchTme = new Date()
const QUERY_THRESHOLD_START = process.env.QUERY_THRESHOLD_START || 60 * 1000
const QUERY_THRESHOLD_MS = process.env.QUERY_THRESHOLD_MS || 500

const mysql = require('mysql')

const writerOptions = {
	connectionLimit: process.env.CONNECTION_LIMIT || 30,
	host: process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD || '123',
	database: process.env.SQL_TABLE || 'test',
	multipleStatements: true,
	charset: 'utf8mb4'
}
const writerPool = mysql.createPool(writerOptions)
setPool(writerPool)

const readerOptions = {
	connectionLimit: process.env.CONNECTION_LIMIT_READER || process.env.CONNECTION_LIMIT || 30,
	host: process.env.SQL_HOST_READER || process.env.SQL_HOST || '127.0.0.1',
	user: process.env.SQL_USER_READER || process.env.SQL_USER || 'root',
	password: process.env.SQL_PASSWORD_READER || process.env.SQL_PASSWORD || '123',
	database: process.env.SQL_TABLE || 'test',
	multipleStatements: true,
	charset: 'utf8mb4'
}

const readerPool = mysql.createPool(readerOptions)
setPool(readerPool)


console.log('pool-mysql writer host: ', writerOptions.host)
console.log('pool-mysql reader host: ', readerOptions.host)

const logLevel = {
	all: (err, toPrint) => {
		console.log(toPrint)
	},
	error: (err, toPrint) => {
		if (!err) {
			return
		}
		console.log(toPrint)
	},
	none: (err, toPrint) => {

	},
	oneTime: (err, toPrint) => {
		console.log(toPrint)
		logger = logLevel.error
	}
}

let logger = logLevel.error

function trimed(params) {
	return params.replace(/\t/g, '').replace(/\n/g, ' ').trim()
}

class Connection {
	constructor(reader, writer) {
		this.reader = reader
		this.writer = writer
		this.useWriter = false
	}

	async beginTransaction(cb) {
		try {
			await this.reader.startTransaction()
			await this.writer.startTransaction()
			cb(undefined)
		} catch (e) {
			cb(e)
		}
	}

	async awaitTransaction() {
		return new Promise(async (resolve, reject) => {
			try {
				await this.reader.startTransaction()
				await this.writer.startTransaction()
				resolve()
			} catch (e) {
				reject(e)
			}
		})
	}

	async awaitCommit() {
		return new Promise(async (resolve, reject) => {
			try {
				await this.reader.commit()
				await this.writer.commit()
				resolve()
			} catch (e) {
				reject(e)
			}
		})
	}

	query(sql, values, cb) {
		const connection = this.useWriter ? this.writer : this.getReaderOrWriter(sql)
		this.useWriter = false

		let command = sql.sql || sql

		if (this.isSelect(command) && this._noCache) {
			command = command.replace(/^select/gi, 'SELECT SQL_NO_CACHE ')
		}
		this._noCache = false


		const mustUpdateOneRow = this._mustUpdateOneRow
		this._mustUpdateOneRow = false

		const query = {
			sql: trimed(command),
			nestTables: sql.nestTables
		}

		const q = connection.query(query, values, (a, b, c) => {
			if (mustUpdateOneRow && b && b.affectedRows != 1) {
				// console.log(a, b, c)
				return cb(a || Error('MUST_UPDATE_ONE_ROW'), b, c)
			} else if (mustUpdateOneRow && b && b.affectedRows == 1) {
				// console.log(a, b, c)
				// console.log('changed a row')
			}

			cb(a, b, c)
		})

		const string = mustUpdateOneRow ? 'mustUpdateOneRow' : ''

		logger(null, `${connection.logPrefix} : (${string}) ${q.sql}`)

		return {}
	}

	_q(sql, values) {
		return new Promise((reslove, reject) => {
			const from = new Date()
			this.query(sql, values, (err, res) => {
				const to = new Date()
				const cost = to - from

				logger(to - launchTme > QUERY_THRESHOLD_START && cost > QUERY_THRESHOLD_MS, `| Long Query: ${cost} ms\n| ${sql.sql}`)

				if (err) {
					reject(err)
				} else {
					reslove(res)
				}
			})
		})
	}

	async q(sql, values, { key, EX, isJSON = true, cachedToResult, shouldRefreshInCache /*= (someThing) => { return true }*/, map, queryToResult, queryToCache, redisPrint } = {}) {

		if (!EX) {
			return await this._q(sql, values)
		} else if (!pool.redisClient && EX) {
			console.error('should assign redis client to pool.redisClient')
			return await this._q(sql, values)
		}

		const queryString = mysql.format((sql.sql || sql), values).split('\n').join(' ')
		const cacheKey = key || queryString

		let someThing = isJSON
			? await pool.redisClient.getJSONAsync(cacheKey)
			: await pool.redisClient.getAsync(cacheKey)

		//if cached
		const keepCache = shouldRefreshInCache ? !shouldRefreshInCache(someThing) : true
		if (someThing && keepCache) {
			if (redisPrint) {
				console.log('Cached in redis: true')
			}

			if (someThing.isNull) {
				return null
			}

			someThing = cachedToResult ? cachedToResult(someThing) : someThing
			return someThing
		}

		const result = await this._q(sql, values)

		if (redisPrint) {
			console.log('Cached in redis: false ')
		}

		let toCache = map
			? map(result)
			: queryToCache
				? queryToCache(result)
				: result


		if (toCache === null) {
			toCache = { isNull: true }
		}

		isJSON
			? await pool.redisClient.setJSONAsync(cacheKey, toCache, 'EX', EX)
			: await pool.redisClient.setAsync(cacheKey, toCache, 'EX', EX)

		return map
			? map(result)
			: queryToResult ? queryToResult(result) : result
	}

	commit(cb) {
		this.writer.commit((e) => {
			if (this.writer) {
				logger(e, this.writer.logPrefix + ' : COMMIT')
			}

			if (cb) {
				cb(e)
			}
		})
	}

	rollback() {
		return new Promise((resolve, reject) => {
			const x = this.reader.rollback(() => {
				const y = this.writer.rollback(() => {
					logger(null, '[' + (x._connection.threadId || 'default') + ']  : ' + x.sql)
					logger(null, '[' + (y._connection.threadId || 'default') + ']  : ' + y.sql)
					resolve()
				})
			})
		})
	}

	release() {
		if (this.reader && readerPool._freeConnections.indexOf(this.reader)) {
			logger(null, this.reader.logPrefix + ' : RELEASE')
			this.reader.release()
		}

		if (this.writer && writerPool._freeConnections.indexOf(this.writer)) {
			logger(null, this.writer.logPrefix + ' : RELEASE')
			this.writer.release()
		}
	}

	isSelect(sql) {
		const command = trimed((sql.sql || sql).toLowerCase())

		if ((/^select/i).test(command) && command.indexOf('for update') == -1) {
			return true
		}
		return false
	}

	getReaderOrWriter(sql) {
		return this.isSelect(sql) ? this.reader : this.writer
	}

	get forceWriter() {
		this.useWriter = true
		return this
	}

	get print() {
		logger = logLevel.oneTime
		return this
	}

	get noCache() {
		this._noCache = true
		return this
	}

	get mustUpdateOneRow() {
		this._mustUpdateOneRow = true
		return this
	}

	get mustAffected() {
		this._mustAffected = true
		return this
	}

	get mustAffectedOneRow() {
		this._mustAffectedOne = true
		return this
	}

	get mustChanged() {
		this._mustChanged = true
		return this
	}

	get mustChangedOneRow() {
		this._mustChangedOneRow = true
		return this
	}
}

//manager
class Pool {
	set logger(string) {
		switch (string) {
			case 'all':
				logger = logLevel.all
				break
			case 'error':
				logger = logLevel.error
				break
			default:
				logger = logLevel.none
				break
		}
	}

	get Schema() {
		return require('./Schema')
	}

	get logger() {
		return logger
	}

	get redisClient() {
		return this._redisClient
	}

	set redisClient(newValue) {
		this._redisClient = newValue

		if (!this._redisClient) {
			return
		}

		if (!this._redisClient.getJSONAsync) {
			this._redisClient.getJSONAsync = async (...args) => {
				const result = await pool.redisClient.getAsync(...args)
				return JSON.parse(result)
			}
		}

		if (!this._redisClient.setJSONAsync) {
			this._redisClient.setJSONAsync = async (...args) => {
				args[1] = JSON.stringify(args[1])
				return await pool.redisClient.setAsync(...args)
			}
		}
	}

	createConnection() {
		return new Promise(async (resolve, reject) => {
			try {
				const reader = await readerPool.createConnection()
				reader.role = 'Reader'
				setConnection(reader)

				const writer = await writerPool.createConnection()
				writer.role = 'Writer'
				setConnection(writer)

				const manager = new Connection(reader, writer)

				resolve(manager)
			} catch (e) {
				reject(e)
			}
		})
	}

	query(sql, values, callback) {
		writerPool.query(sql, values, callback)
		return {}
	}
}

const pool = new Pool()
module.exports = pool

function setPool(pool) {
	pool.createConnection = () => {
		return new Promise((resolve, reject) => {
			pool.getConnection((err, connection) => {
				if (err) {
					logger(err)
					return reject(err)
				}
				setConnection(connection)
				resolve(connection)
			})
		})
	}

	pool.query = (sql, values, callback) => {
		pool.getConnection((err, connection) => {
			logger(err, 'pool.query')
			if (err) {
				connection.release()
				return callback(err, null)
			}

			connection.query(sql, values, (err, result) => {
				connection.release()
				callback(err, result)
			})
		})

		return {}
	}

	pool.release = () => { }
}

function setConnection(connection) {
	connection.q = (sql, values) => {
		return new Promise((resolve, reject) => {
			connection.query(sql, values, (err, result) => {
				if (err) {
					reject(err)
				} else {
					resolve(result)
				}
			})
		})
	}

	connection.startTransaction = () => {
		return new Promise((resolve, reject) => {
			connection.beginTransaction((err) => {
				if (err) {
					logger(err, undefined)
					reject(err)
				} else {
					resolve(connection)
				}
			})
		})
	}

	connection.commitChange = () => {
		return new Promise((resolve, reject) => {
			connection.commit((err) => {
				if (err) {
					logger(err, undefined)
					reject(err)
				} else {
					resolve(connection)
				}
			})
		})
	}

	connection.logPrefix = `[${(connection.threadId || 'default')}] ${connection.role}`
}
