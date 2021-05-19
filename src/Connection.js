const launchTme = new Date()

const mysql = require('mysql')
const throwError = require('./Helper/throwError')
const Event = require('./Logger/Event')

const Combine = require('./Schema/Combine')

module.exports = class Connection {
	constructor(pool) {
		this._pool = pool

		this.useWriter = false

		this.id = pool.connectionID

		this.tag = {
			name: 'default',
			limit: this._pool.options.connectionLimit
		}

		this.createdAt = new Date()
		this.gotAt = new Date()

		this._resetStatus()
	}

	_resetStatus() {
		this._status = {}
	}

	get isUsing() {
		return !!this.tag && this._pool.connectionPool.using[this.tag.name][this.id] != undefined
	}

	async toConnect(type = 'All') {
		switch (type) {
			case 'All':
				this.writer = await this._pool._mysqlConnectionManager.getWriter(this)
				this.reader = await this._pool._mysqlConnectionManager.getReader(this)
				break
			case 'Writer':
				this.writer = await this._pool._mysqlConnectionManager.getWriter(this)
				break
			case 'Reader':
				this.reader = await this._pool._mysqlConnectionManager.getReader(this)
				break
		}

		return this
	}

	async awaitTransaction() {
		await this.beginTransaction()
	}

	// AKA awaitTransaction
	async beginTransaction(cb = () => { }) {
		try {
			if (!this.writer) {
				this.writer = await this._pool._mysqlConnectionManager.getWriter(this)
			}

			await this.writer.startTransaction()
			this._status.isStartedTransaction = true
			cb(undefined)
		} catch (e) {
			cb(e)
		}
	}

	query(sql, bb, cc) {
		let values = bb
		let cb = cc

		if (bb instanceof Function) {
			values = null
			cb = bb
		}

		this._q(sql, values)
			.then(data => cb(undefined, data))
			.catch(err => cb(err, undefined))
	}

	async _q(sql, values) {
		let sqlStatement = sql.sql || sql

		if (!this.isUsing) {
			Event.emit('log', `
	pool-mysql: connection is not using, might released too early
	Query: ${sqlStatement}
			`)

			throwError('connection is not using, might released too early, fix it or rollback')
		}

		// is pool.mock available
		if (process.env.NODE_ENV !== 'production' && this._pool.mock && !isNaN(this._pool._mockCounter)) {
			return this._pool.mock(this._pool._mockCounter++, sqlStatement)
		}

		const mysqlConnection = await this.getReaderOrWriter(sql, this.useWriter)
		this.useWriter = false

		if (this.isSelect(sqlStatement) && this._noCache) {
			sqlStatement = sqlStatement.replace(/^select/gi, 'SELECT SQL_NO_CACHE ')
		}
		this._noCache = false

		const mustUpdateOneRow = this._mustUpdateOneRow
		this._mustUpdateOneRow = false

		const print = this._print
		this._print = false

		const query = {
			sql: mysql.format(sqlStatement.trim(), values),
			nestTables: sql.nestTables
		}

		this.querying = query.sql
		this.latestQuery = query.sql

		Event.emit('will_query', query.sql)

		const startTime = new Date()

		// Query
		const { result, fields: _ } = await mysqlConnection.qV2(query)

		const endTime = new Date()

		delete this.querying
		//log
		const optionsString = [
			mustUpdateOneRow ? 'mustUpdateOneRow' : ''
		].join(',')

		const costTime = endTime - startTime
		const isLongQuery = endTime - launchTme > this._pool.options.QUERY_THRESHOLD_START && costTime > this._pool.options.QUERY_THRESHOLD_MS
		const printString = `${mysqlConnection.logPrefix} ${isLongQuery ? 'Long Query' : ''} ${costTime}ms: ${optionsString} ${query.sql}`

		if (isLongQuery) {
			Event.emit('log', 'Long Query', printString)
		} else if (print) {
			Event.emit('log', 'PRINT()', printString)
		} else {
			Event.emit('log', undefined, printString)
		}

		//emit
		Event.emit('query', printString)
		Event.emit('did_query', query.sql)

		if (mustUpdateOneRow && result && result.affectedRows != 1) {
			throw Error(`MUST_UPDATE_ONE_ROW: ${query.sql}`)
		}

		return result
	}

	async q(sql, values, { key, EX, shouldRefreshInCache, redisPrint, combine } = {}) {
		const onErr = this._onErr
		delete this._onErr


		const queryString = mysql.format((sql.sql || sql), values).split('\n').join(' ')
		const queryKey = key || queryString

		try {
			if (!EX) {
				if (combine && Combine.isQuerying(queryKey)) {
					return await Combine.subscribe(queryKey)
				} else if (combine) {
					Combine.bind(queryKey)
					const result = await this._q(sql, values)
					Combine.publish(queryKey, undefined, result)
					return result
				}

				//一般查詢, 不需要redis cache
				return await this._q(sql, values)
			}

			if (EX && !this._pool.redisClient) {
				Event.emit('log', 'should assign redis client to this._pool.redisClient')
				return await this._q(sql, values)
			}

			const someThing = await this._pool.redisClient.getJSONAsync(queryKey)

			//if cached
			const keepCache = shouldRefreshInCache ? !shouldRefreshInCache(someThing) : true
			if (someThing && keepCache) {
				if (redisPrint) {
					Event.emit('log', undefined, 'Cached in redis: true')
				}

				if (someThing.isNull) {
					return null
				}

				return someThing
			}

			// always combine
			if (Combine.isQuerying(queryKey)) {
				return await Combine.subscribe(queryKey)
			} else {
				Combine.bind(queryKey)
			}

			const result = await this._q(sql, values)

			if (redisPrint) {
				Event.emit('log', undefined, 'Cached in redis: false ')
			}

			let toCache = result

			if (toCache === null) {
				toCache = { isNull: true }
			}

			await this._pool.redisClient.setJSONAsync(queryKey, toCache, 'EX', EX)

			Combine.publish(queryKey, undefined, result)
			return result
		} catch (error) {
			Combine.publish(queryKey, error, undefined)

			switch (true) {
				case typeof onErr == 'string':
					// eslint-disable-next-line no-console
					Event.emit('log', error)
					throw Error(onErr)
				case typeof onErr == 'function':
					// eslint-disable-next-line no-console
					Event.emit('log', error)
					throw Error(onErr(error))
				default:
					throw error
			}
		}
	}

	commit(cb = () => { }) {
		this.awaitCommit().then(cb).catch(cb)
	}

	async awaitCommit() {
		const awaitCommit = require('util').promisify(this.writer.commit)

		try {
			await awaitCommit()
			Event.emit('log', undefined, `${this.writer.logPrefix} : COMMIT`)
		} catch (error) {
			Event.emit('log', error, `${this.writer.logPrefix} : COMMIT`)
		} finally {
			this._status.isCommitted = true
		}
	}

	async rollback() {
		return new Promise(resolve => {
			const y = this.writer.rollback(() => {
				this._status.isCommitted = true
				Event.emit('log', null, '[' + (y._connection.threadId || 'default') + ']  : ' + y.sql)
				resolve()
			})
		})
	}

	release() {
		Event.emit('log', null, `[${this.id}] RELEASE`)

		if (this._status.isStartedTransaction && !this._status.isCommitted) {
			Event.emit('log', undefined, 'pool-mysql: Transaction started, should be Committed')
		}
		this._resetStatus()

		if (this.reader) {
			this.reader.returnToPool()
			delete this.reader
		}

		if (this.writer) {
			this.writer.returnToPool()
			delete this.writer
		}

		this._pool._recycle(this)
	}

	end() {
		if (this.reader) {
			this.reader.end()
		}
		if (this.writer) {
			this.writer.end()
		}

		Event.emit('end', this)

		delete this._pool
		delete this.reader
		delete this.writer
	}

	isSelect(sql) {
		const command = (sql.sql || sql).trim().toLowerCase()

		return (/^select/i).test(command) && command.indexOf('for update') == -1
	}

	async getReaderOrWriter(sql, useWriter) {
		if (this.isSelect(sql) && !useWriter) {
			if (!this.reader) {
				await this.toConnect('Reader')
			}
			return this.reader
		} else {
			if (!this.writer) {
				await this.toConnect('Writer')
			}
			return this.writer
		}
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
}
