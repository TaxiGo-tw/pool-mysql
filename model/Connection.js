const launchTme = new Date()
const QUERY_THRESHOLD_START = process.env.QUERY_THRESHOLD_START || 60 * 1000
const QUERY_THRESHOLD_MS = process.env.QUERY_THRESHOLD_MS || 500

const mysql = require('mysql')

function trimed(params) {
	return params.replace(/\t/g, '').replace(/\n/g, ' ').trim()
}
module.exports = class Connection {
	constructor(pool) {
		this._pool = pool

		this.reader = this._mysqlConnection(this._pool.options.reader, 'Reader', this)
		this.writer = this._mysqlConnection(this._pool.options.writer, 'Writer', this)
		this.useWriter = false

		this.id = pool.connectionID

		this.createdAt = new Date()
		this.gotAt = new Date()
	}

	async connect() {
		const crConnection = async (connection) => {
			return new Promise((resolve, reject) => {
				connection.connect(err => {
					if (err) {
						this._pool.logger(err)
						return reject(err)
					}

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
			// await this.reader.startTransaction()
			await this.writer.startTransaction()
			cb(undefined)
		} catch (e) {
			cb(e)
		}
	}

	async awaitTransaction() {
		return new Promise(async (resolve, reject) => {
			try {
				// await this.reader.startTransaction()
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
				// await this.reader.commit()
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

		const print = this._print
		this._print = false

		const query = {
			sql: trimed(command),
			nestTables: sql.nestTables
		}

		const startTime = new Date()

		this.querying = command
		const q = connection.query(query, values, (a, b, c) => {
			delete this.querying

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
				this._pool.logger(isLongQuery, printString, __function, __line)
			} else if (print) {
				printString = `${connection.logPrefix} ${costTime}ms: ${string} ${q.sql || sql}`
				this._pool.logger(1, printString)
			} else {
				printString = `${connection.logPrefix} ${costTime}ms: ${string} ${q.sql || sql}`
				this._pool.logger(null, printString)
			}

			this._pool.event.emit('query', printString)

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
		} else if (!this._pool.redisClient && EX) {
			console.error('should assign redis client to this._pool.redisClient')
			return await this._q(sql, values)
		}

		const queryString = mysql.format((sql.sql || sql), values).split('\n').join(' ')
		const cacheKey = key || queryString

		let someThing = isJSON
			? await this._pool.redisClient.getJSONAsync(cacheKey)
			: await this._pool.redisClient.getAsync(cacheKey)

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
			? await this._pool.redisClient.setJSONAsync(cacheKey, toCache, 'EX', EX)
			: await this._pool.redisClient.setAsync(cacheKey, toCache, 'EX', EX)

		return map
			? map(result)
			: queryToResult ? queryToResult(result) : result
	}

	commit(cb) {
		this.writer.commit((e) => {
			if (this.writer) {
				this._pool.logger(e, `${this.writer.logPrefix} : COMMIT`)
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
					this._pool.logger(null, '[' + (x._connection.threadId || 'default') + ']  : ' + x.sql)
					this._pool.logger(null, '[' + (y._connection.threadId || 'default') + ']  : ' + y.sql)
					resolve()
				})
			})
		})
	}

	release() {
		this._pool.logger(null, `[${this.id}] RELEASE`)
		this._pool._recycle(this).then().catch(console.log)
	}

	end() {
		this.reader.end()
		this.writer.end()

		delete this._pool
		delete this.reader
		delete this.writer

		this.pool.event.emit('end', this)
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
		this._print = true
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


	_mysqlConnection(option, role, connection) {
		const mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role

		mysqlConnection.on('error', err => {
			//丟掉這個conneciton
			connection.end()
			// if (err.code === 'PROTOCOL_CONNECTION_LOST') {
			// 	// db error 重新連線
			// 	connection.connect(err => {
			// 		if (err) {
			// 			setTimeout(() => {
			// 				connection.connect()
			// 			}, 300)
			// 		}
			// 	})
			// } else {
			// 	console.log('mysql connection', err)
			// 	throw err
			// }
		})

		mysqlConnection.q = (sql, values) => {
			return new Promise((resolve, reject) => {
				mysqlConnection.query(sql, values, (err, result) => {
					if (err) {
						reject(err)
					} else {
						resolve(result)
					}
				})
			})
		}

		mysqlConnection.startTransaction = () => {
			return new Promise((resolve, reject) => {
				mysqlConnection.beginTransaction((err) => {
					this._pool.logger(err, `${mysqlConnection.logPrefix} : Start Transaction`)
					if (err) {
						reject(err)
					} else {
						resolve(mysqlConnection)
					}
				})
			})
		}

		mysqlConnection.commitChange = () => {
			return new Promise((resolve, reject) => {
				mysqlConnection.commit((err) => {
					this._pool.logger(err, `${mysqlConnection.logPrefix} : COMMIT`)
					if (err) {
						reject(err)
					} else {
						resolve(mysqlConnection)
					}
				})
			})
		}

		return mysqlConnection
	}
}
