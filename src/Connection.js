const launchTme = new Date()

const mysql = require('mysql')
const throwError = require('./Helper/throwError')
const Event = require('./Logger/Event')

/**
 * @typedef {import('./Pool')} Pool
 */
module.exports = class Connection {
	/**
   * @param {Pool} pool
   */
	constructor(pool) {
		this._pool = pool

		this.gotAt = new Date()

		this.randomID = Math.random().toString(36).substr(2, 9)

		this.resetStatus()
	}

	identity(mysqlConnection) {
		if (mysqlConnection) {
			return `[Pool:${this._pool.options.poolID}] [Connection:${this.gotAt.getTime() % 100000}${this.randomID}] [${mysqlConnection.role}:${mysqlConnection.id || ''}]`
		}
		return `[Pool:${this._pool.options.poolID}] [Connection:${this.gotAt.getTime() % 100000}${this.randomID}]`
	}

	resetStatus() {
		this._status = {
			useWriter: this._pool.options.forceWriter,
			print: false,
			mustUpdateOneRow: false,
			onErr: undefined
		}
	}

	async genWriter() {
		if (this.writer) {
			return
		}

		const manager = this._pool._mysqlConnectionManager
		const writeKey = `connection:writer:${this.identity()}:connect`
		const combine = this._pool.combine

		if (combine.isQuerying(writeKey)) {
			return await combine.subscribe(writeKey)
		} else {
			combine.bind(writeKey)
			const writer = await manager.getWriter(this)
			this.writer = writer
			combine.publish(writeKey, undefined, writer)
			return writer
		}
	}

	async genReader() {
		if (this.reader) {
			return
		}
		const manager = this._pool._mysqlConnectionManager
		const readKey = `connection:reader:${this.identity()}:connect`
		const combine = this._pool.combine

		if (combine.isQuerying(readKey)) {
			return await combine.subscribe(readKey)
		} else {
			combine.bind(readKey)
			const reader = await manager.getReader(this)
			this.reader = reader
			combine.publish(readKey, undefined, reader)
			return reader
		}
	}

	/**
   * Lazily acquires underlying MySQL connections.
   * @param {'All' | 'Writer' | 'Reader'} [type='All'] Which connections to acquire. Defaults to `'All'`.
   * @returns {Promise<this>} Promise resolving to the current `Connection` instance so calls can be chained.
   */
	async connect(type = 'All') {
		switch (type) {
			case 'All':
				await this.genWriter()
				await this.genReader()
				break
			case 'Writer':
				await this.genWriter()
				break
			case 'Reader':
				await this.genReader()
				break
		}

		return this
	}

	/**
   * @deprecated use `beginTransaction` for naming style
   * @returns {Promise<void>}
   */
	async awaitTransaction() {
		await this.beginTransaction()
	}

	/**
   * Starts a transaction on the writer connection.
   * @param {(error?: Error) => void} [cb]
   * @returns {Promise<void>}
   */
	async beginTransaction(cb = () => {}) {
		try {
			await this.genWriter()

			await this.writer.beginTransactionAsync()
			this._status.isStartedTransaction = true
			cb(undefined)
		} catch (e) {
			cb(e)
		}
	}

	/**
   * @deprecated use `q()` for async/await
   * Legacy callback-style query method.
   * @param {string | { sql: string; nestTables?: any }} sql
   * @param {any[] | Record<string, any>} [values]
   * @param {(error: Error | null, results: any) => void} [cb]
   */
	query(sql, bb, cc) {
		let values = bb
		let cb = cc

		if (bb instanceof Function) {
			values = undefined
			cb = bb
		}

		this.q(sql, values)
			.then(data => cb(undefined, data))
			.catch(cb)
	}

	async _q(sql, values) {
		const sqlStatement = sql.sql || sql

		// is pool.mock available
		if (this._pool.mockable) {
			return this._pool.mock(this._pool._mockCounter++, sqlStatement)
		}

		const { useWriter, print, mustUpdateOneRow } = this._status

		const mysqlConnection = await this._getReaderOrWriter(sql, useWriter)

		const query = {
			sql: mysql.format(sqlStatement.trim(), values),
			nestTables: sql.nestTables
		}

		Event.emit('will_query', this.identity(), query.sql)

		const startTime = new Date()

		// 先拿掉, 有問題再說
		// if (mysqlConnection.querying) {
		// 	const message = `${mysqlConnection.identity()} is querying in the same time with "${mysqlConnection.querying}" and "${query.sql}"`
		// 	Event.emit('warn', this.identity(), message)

		// 	if (process.env.NODE_ENV == 'TESTING') {
		// 		throwError(message)
		// 	}
		// }

		this._status.querying = query.sql
		mysqlConnection.querying = query.sql
		mysqlConnection.last_query = mysqlConnection.querying
		// Query
		const { result, fields: _ } = await mysqlConnection.q(query)

		mysqlConnection.querying = undefined

		const endTime = new Date()

		//log
		const optionsString = [
			mustUpdateOneRow ? 'mustUpdateOneRow' : ''
		].join(',')

		const costTime = endTime - startTime
		const isLongQuery = endTime - launchTme > this._pool.options.QUERY_THRESHOLD_START && costTime > this._pool.options.QUERY_THRESHOLD_MS
		const printString = `${isLongQuery ? 'Long Query' : ''} ${costTime}ms: ${optionsString} ${query.sql}`

		if (isLongQuery) {
			Event.emit('longQuery', printString)
		} else if (print) {
			Event.emit('print', printString)
		} else {
			Event.emit('log', this.identity(mysqlConnection), printString)
		}

		//emit
		Event.emit('did_query', this.identity(), query.sql)

		if (mustUpdateOneRow && result && result.affectedRows != 1) {
			this._status.mustUpdateOneRow = false
			throw Error(`MUST_UPDATE_ONE_ROW: ${query.sql}`)
		}

		this.resetStatus()

		return result
	}

	_queryMode({ EX, combine, queryKey } = {}) {
		if (!EX) {
			if (!combine) {
				return { Normal: true }
			} else if (this._pool.combine.isQuerying(queryKey)) { //查詢中則等結果
				return { CombineSubscriber: true }
			}
			return { CombineLeader: true }
		} else {
			//想要redis cache 卻沒有client
			if (!this._pool.redisClient) {
				return { Normal: true }
			}

			return { Caching: true }
		}
	}

	/**
   * Preferred Promise-based query helper.
   * @param {string | { sql: string; nestTables?: any }} sql
   * @param {any[] | Record<string, any>} [values]
   * @param {{key?: string; EX?: number; shouldRefreshInCache?: (cached: any) => boolean; redisPrint?: boolean; combine?: boolean}} [options]
   * @returns {Promise<any>}
   */
	async q(sql, values, { key, EX, shouldRefreshInCache, redisPrint, combine } = {}) {

		const queryString = mysql.format((sql.sql || sql), values).replace(/\n/g, '')
		const queryKey = key || queryString
		const onErr = this._status.onErr

		try {
			const QueryMode = this._queryMode({ EX, combine, queryKey })

			switch (true) {
				case QueryMode.Normal: {
					return await this._q(sql, values)
				} case QueryMode.CombineSubscriber: { // 等人查好
					return await this._pool.combine.subscribe(queryKey)
				} case QueryMode.CombineLeader: {	//帶頭查

					this._pool.combine.bind(queryKey)
					const result = await this._q(sql, values)
					this._pool.combine.publish(queryKey, undefined, result)
					return result
				} case QueryMode.Caching: {

					//以下想要redis cache 且有client

					const someThing = await this._pool.redisClient.getJSONAsync(queryKey)

					//if cached
					const keepCache = shouldRefreshInCache ? !shouldRefreshInCache(someThing) : true
					if (someThing && keepCache) {
						if (redisPrint) {
							Event.emit('log', this.identity(), 'Cached in redis: true')
						}

						if (someThing.isNull) {
							return null
						}

						return someThing
					}

					// always combine
					if (this._pool.combine.isQuerying(queryKey)) {
						return await this._pool.combine.subscribe(queryKey)
					} else {
						this._pool.combine.bind(queryKey)
					}

					const result = await this._q(sql, values)

					if (redisPrint) {
						Event.emit('log', this.identity(), 'Cached in redis: false ')
					}

					const toCache = (result !== null) ? result : { isNull: true }

					await this._pool.redisClient.setJSONAsync(queryKey, toCache, 'EX', EX)

					this._pool.combine.publish(queryKey, undefined, result)
					return result
				}
				default:
					throw Error('wrong QueryMode')
			}
		} catch (error) {
			this._pool.combine.publish(queryKey, error, undefined)

			switch (true) {
				case typeof onErr == 'string': {
					const err = Error(onErr)
					Event.emit('err', this.identity(), err)

					throw err
				} case typeof onErr == 'function':
					Event.emit('err', this.identity(), Error(onErr(error)))
					throw Error(onErr(error))
				default:
					Event.emit('err', this.identity(), error)
					throw error
			}
		}
	}

	/**
   * @deprecated use `commitAsync()` for async/await
   * Commit the current transaction (callback style).
   * @param {(error: Error | null, result: any) => void} [cb]
   */
	commit(cb = () => { }) {
		this.commitAsync().then(r => cb(undefined, r)).catch(e => cb(e))
	}

	/**
   * @deprecated use `commitAsync()` for naming style
   * @returns {Promise<void>}
   */
	async awaitCommit() {
		await this.commitAsync()
	}

	/**
   * Commit the current transaction (Promise style).
   * @returns {Promise<void>}
   */
	async commitAsync() {
		try {
			if (!this.writer) {
				Event.emit('log', this.identity(), `nothing : COMMIT`)
				return
			}

			await this.writer.commitAsync()
			Event.emit('log', this.identity(this.writer), `COMMIT`)
		} catch (error) {
			Event.emit('err', this.identity(this.writer) + `COMMIT`, error)
		} finally {
			this._status.isCommitted = true
		}
	}

	/**
   * Rollback the current transaction.
   * @returns {Promise<void>}
   */
	async rollback() {
		if (!this.writer) {
			Event.emit('log', this.identity(), `nothing : ROLLBACK`)
			return
		}

		return new Promise(resolve => {
			const y = this.writer.rollback(() => {
				this._status.isCommitted = true
				Event.emit('log', this.identity(), `${y.sql}`)
				resolve()
			})
		})
	}

	/**
   * Release underlying driver connections back to their pools.
   */
	release() {
		Event.emit('log', this.identity(), `RELEASE`)

		if (this._status.isStartedTransaction && !this._status.isCommitted) {
			Event.emit('warn', this.identity(), Error('Transaction started, should be Committed before commit', this.identity()))
		}

		if (this.reader) {
			this.reader.returnToPool()
			delete this.reader
		}

		if (this.writer) {
			this.writer.returnToPool()
			delete this.writer
		}
	}

	/**
   * Close underlying driver connections and destroy references.
   */
	end() {
		Event.emit('end', this.identity(), this)

		if (this.reader) {
			this.reader.close()
			delete this.reader
		}

		if (this.writer) {
			this.writer.close()
			delete this.writer
		}

		delete this._pool
	}

	/**
   * @param {string} sql
   * @returns {boolean}
   */
	isSelect(sql) {
		const command = (sql.sql || sql).trim().toLowerCase()

		return (/^select/i).test(command) && command.indexOf('for update') == -1
	}

	async _getReaderOrWriter(sql, useWriter) {
		if (this.isSelect(sql) && !useWriter) {
			if (!this.reader) {
				this.reader = await this.genReader()
			}

			return this.reader
		} else {
			if (!this.writer) {
				this.writer = await this.genWriter()
			}

			return this.writer
		}
	}

	/**
   * Force queries issued after this call to use the writer connection.
   * @returns {this}
   */
	get forceWriter() {
		this._status.useWriter = true
		return this
	}

	/**
   * Log query even if it isn't considered a long query.
   * @returns {this}
   */
	get print() {
		this._status.print = true
		return this
	}

	/**
   * Ensure that exactly one row is affected by UPDATE / DELETE.
   * @returns {this}
   */
	get mustUpdateOneRow() {
		this._status.mustUpdateOneRow = true
		return this
	}

	/**
   * Supply a custom error mapper or message.
   * @param {((error: any) => string) | string} callbackOrString
   * @returns {this}
   */
	onErr(callbackOrString) {
		this._status.onErr = callbackOrString
		return this
	}
}
