const launchTme = new Date()
const QUERY_THRESHOLD_START = process.env.QUERY_THRESHOLD_START || 60 * 1000
const QUERY_THRESHOLD_MS = process.env.QUERY_THRESHOLD_MS || 500

const mysql = require('mysql')
const LogLevel = require('./LogLevel')

function setConnection(connection) {
	connection.on('error', err => {
		if (err.code === 'PROTOCOL_CONNECTION_LOST') {
			// db error 重新連線
			console.log('db error 重新連線')
			connection.connect(err => {
				setTimeout(() => {
					connection.connect()
				}, 300)
			})
		} else {
			throw err
		}
	})

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
					this.pool.logger(err, undefined)
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
					this.pool.logger(err, undefined)
					reject(err)
				} else {
					resolve(connection)
				}
			})
		})
	}

	// connection.logPrefix = `[${(connection.threadId || 'default')}] ${connection.role}`
}

function trimed(params) {
	return params.replace(/\t/g, '').replace(/\n/g, ' ').trim()
}

const mysqlConnection = (option, role) => {
	const connection = mysql.createConnection(option)
	connection.role = role
	return connection
}

module.exports = class Connection {
	constructor(pool) {
		this.pool = pool

		this.reader = mysqlConnection(this.pool.options.reader, 'Reader')
		this.writer = mysqlConnection(this.pool.options.writer, 'Writer')
		this.useWriter = false

		this.id = ++pool.connectionID
	}

	async connect() {
		const crConnection = async (connection) => {
			return new Promise((resolve, reject) => {
				connection.connect(err => {
					if (err) {
						this.pool.logger(err)
						return reject(err)
					}

					setConnection(connection)
					connection.logPrefix = `[${(this.id || 'default')}] ${connection.role}`

					resolve(connection)
				})
			})
		}

		await crConnection(this.reader)
		await crConnection(this.writer)

		return this
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

		const startTime = new Date()

		const q = connection.query(query, values, (a, b, c) => {
			const endTime = new Date()
			if (mustUpdateOneRow && b && b.affectedRows != 1) {
				// console.log(a, b, c)
				return cb(a || Error('MUST_UPDATE_ONE_ROW'), b, c)
			} else if (mustUpdateOneRow && b && b.affectedRows == 1) {
				// console.log(a, b, c)
				// console.log('changed a row')
			}

			//log
			const string = mustUpdateOneRow ? 'mustUpdateOneRow' : ''
			const costTime = endTime - startTime
			let printString

			const isLongQuery = endTime - launchTme > QUERY_THRESHOLD_START && costTime > QUERY_THRESHOLD_MS
			if (isLongQuery) {
				printString = `| Long Query: ${costTime} ms ${sql.sql || sql}`
				this.pool.logger(isLongQuery, printString, __function, __line)
			} else {
				printString = `${connection.logPrefix} ${costTime}ms: ${string} ${q.sql || sql}`
				this.pool.logger(null, printString)
			}

			this.pool.event.emit('query', printString)

			cb(a, b, c)
		})

		return {}
	}

	_q(sql, values) {
		return new Promise((reslove, reject) => {
			this.query(sql, values, (err, res) => {
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
		} else if (!this.pool.redisClient && EX) {
			console.error('should assign redis client to this.pool.redisClient')
			return await this._q(sql, values)
		}

		const queryString = mysql.format((sql.sql || sql), values).split('\n').join(' ')
		const cacheKey = key || queryString

		let someThing = isJSON
			? await this.pool.redisClient.getJSONAsync(cacheKey)
			: await this.pool.redisClient.getAsync(cacheKey)

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
			? await this.pool.redisClient.setJSONAsync(cacheKey, toCache, 'EX', EX)
			: await this.pool.redisClient.setAsync(cacheKey, toCache, 'EX', EX)

		return map
			? map(result)
			: queryToResult ? queryToResult(result) : result
	}

	commit(cb) {
		this.writer.commit((e) => {
			if (this.writer) {
				this.pool.logger(e, this.writer.logPrefix + ' : COMMIT')
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
					this.pool.logger(null, '[' + (x._connection.threadId || 'default') + ']  : ' + x.sql)
					this.pool.logger(null, '[' + (y._connection.threadId || 'default') + ']  : ' + y.sql)
					resolve()
				})
			})
		})
	}

	release() {
		this.pool._recycle(this).then().catch(console.log)
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
		this.pool.logger = LogLevel.oneTime
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
