const launchTme = new Date()
const QUERY_THRESHOLD_START = process.env.QUERY_THRESHOLD_START || 60 * 1000
const QUERY_THRESHOLD_MS = process.env.QUERY_THRESHOLD_MS || 500

const mysql = require('mysql')

const Event = require('./Event')

const Cache = require('./Cache')

module.exports = class Connection {
	constructor(pool) {
		this._pool = pool

		this.reader = this._mysqlConnection(this._pool.options.reader, 'Reader', this)
		this.writer = this._mysqlConnection(this._pool.options.writer, 'Writer', this)
		this.useWriter = false

		this.id = pool.connectionID

		this.createdAt = new Date()
		this.gotAt = new Date()

		this._resetStatus()
	}

	_resetStatus() {
		this._status = {}
	}

	get isUsing() {
		return this._pool.connectionPool.using[this.id] != undefined
	}

	async connect() {
		const create = async (connection) => {
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

		await create(this.reader)
		await create(this.writer)

		return this
	}

	async beginTransaction(cb) {
		try {
			// await this.reader.startTransaction()
			await this.writer.startTransaction()
			this._status.isStartedStransaction = true
			cb(undefined)
		} catch (e) {
			cb(e)
		}
	}

	async awaitTransaction() {
		await this.writer.beginTransaction()
	}

	async awaitCommit() {
		return new Promise((resolve, reject) => {
			try {
				this.commit((err) => {
					if (err) {
						return reject(err)
					}
					resolve()
				})
			} catch (e) {
				reject(e)
			}
		})
	}

	query(sql, bb, cc) {
		let values = bb
		let cb = cc

		if (bb instanceof Function) {
			values = null
			cb = bb
		}


		let sqlStatment = sql.sql || sql

		if (!this.isUsing) {
			console.error(`
	pool-mysql: connection is not using, might released too early
	Query: ${sqlStatment}
			`)
		}

		const connection = this.useWriter ? this.writer : this.getReaderOrWriter(sql)
		this.useWriter = false


		if (this.isSelect(sqlStatment) && this._noCache) {
			sqlStatment = sqlStatment.replace(/^select/gi, 'SELECT SQL_NO_CACHE ')
		}
		this._noCache = false

		const mustUpdateOneRow = this._mustUpdateOneRow
		this._mustUpdateOneRow = false

		const print = this._print
		this._print = false

		const query = {
			sql: mysql.format(sqlStatment.trim(), values),
			nestTables: sql.nestTables
		}

		this.querying = query.sql

		Event.emit('will_query', query.sql)

		const startTime = new Date()

		connection.query(query, (a, b, c) => {
			const endTime = new Date()

			delete this.querying
			//log
			const optionsString = [
				mustUpdateOneRow ? 'mustUpdateOneRow' : ''
			].join(',')

			const costTime = endTime - startTime
			const isLongQuery = endTime - launchTme > QUERY_THRESHOLD_START && costTime > QUERY_THRESHOLD_MS
			const printString = `${connection.logPrefix} ${isLongQuery ? 'Long Query' : ''} ${costTime}ms: ${optionsString} ${query.sql}`
			this._pool.logger(print || isLongQuery, printString)

			//emit
			Event.emit('query', printString)
			Event.emit('did_query', query.sql)

			if (mustUpdateOneRow && b && b.affectedRows != 1) {
				return cb(a || Error('MUST_UPDATE_ONE_ROW'), b, c)
			}

			cb(a, b, c)
		})

		return query
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

	async q(sql, values, { key, EX, shouldRefreshInCache, redisPrint } = {}) {
		const onErr = this._onErr
		delete this._onErr

		if (!EX) {
			return await this._q(sql, values)
		} else if (!this._pool.redisClient && EX) {
			console.error('should assign redis client to this._pool.redisClient')
			return await this._q(sql, values)
		}

		const queryString = mysql.format((sql.sql || sql), values).split('\n').join(' ')
		const cacheKey = key || queryString

		try {
			const someThing = await this._pool.redisClient.getJSONAsync(cacheKey)

			//if cached
			const keepCache = shouldRefreshInCache ? !shouldRefreshInCache(someThing) : true
			if (someThing && keepCache) {
				if (redisPrint) {
					console.log('Cached in redis: true')
				}

				if (someThing.isNull) {
					return null
				}

				return someThing
			}

			if (Cache.quering[cacheKey]) {
				return await Cache.waiting(cacheKey)
			} else {
				Cache.quering[cacheKey] = true
			}

			const result = await this._q(sql, values)

			if (redisPrint) {
				console.log('Cached in redis: false ')
			}

			let toCache = result

			if (toCache === null) {
				toCache = { isNull: true }
			}

			await this._pool.redisClient.setJSONAsync(cacheKey, toCache, 'EX', EX)

			Cache.pop(cacheKey, undefined, result)
			return result
		} catch (error) {
			Cache.pop(cacheKey, error, undefined)

			switch (true) {
				case typeof onErr == 'string':
					// eslint-disable-next-line no-console
					console.log('true error', error)
					throw Error(onErr)
				case typeof onErr == 'function':
					// eslint-disable-next-line no-console
					console.log('true error', error)
					throw Error(onErr(error))
				default:
					throw error
			}
		}
	}

	commit(cb) {
		this.writer.commit((e) => {
			if (this.writer) {
				this._pool.logger(e, `${this.writer.logPrefix} : COMMIT`)
			}

			this._status.isCommited = true

			if (cb) {
				cb(e)
			}
		})
	}

	async rollback() {
		return new Promise((resolve, reject) => {
			const x = this.reader.rollback(() => {
				const y = this.writer.rollback(() => {
					this._status.isCommited = true

					this._pool.logger(null, '[' + (x._connection.threadId || 'default') + ']  : ' + x.sql)
					this._pool.logger(null, '[' + (y._connection.threadId || 'default') + ']  : ' + y.sql)
					resolve()
				})
			})
		})
	}

	release() {
		this._pool.logger(null, `[${this.id}] RELEASE`)

		if (this._status.isStartedStransaction && !this._status.isCommited) {
			console.error('pool-mysql: Transaction started, should be Committed')
		}
		this._resetStatus()

		this._pool._recycle(this)
	}

	end() {
		this.reader.end()
		this.writer.end()
		Event.emit('end', this)

		delete this._pool
		delete this.reader
		delete this.writer
	}

	isSelect(sql) {
		const command = (sql.sql || sql).trim().toLowerCase()

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

	onErr(callbackOrString) {
		this._onErr = callbackOrString
		return this
	}

	_mysqlConnection(option, role, connection) {
		const mysqlConnection = mysql.createConnection(option)
		mysqlConnection.role = role

		mysqlConnection.on('error', err => {
			//丟掉這個conneciton
			connection.end()
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
