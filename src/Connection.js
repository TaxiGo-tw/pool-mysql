const launchTme = new Date()

const mysql = require('mysql')
const Event = require('./Logger/Event')

const Combine = require('./Schema/Combine')

module.exports = class Connection {
	constructor(pool) {
		this._pool = pool

		this.tag = {
			name: 'default',
			limit: this._pool.options.connectionLimit
		}

		this.gotAt = new Date()

		this.resetStatus()
	}

	identity() {
		return `Pool:${this._pool.options.poolID} [Connection:${this.id}] `
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
		const manager = this._pool._mysqlConnectionManager

		if (!this.writer) {
			this.writer = await manager.getWriter(this)
		}
	}

	async genReader() {
		const manager = this._pool._mysqlConnectionManager

		if (!this.reader) {
			this.reader = await manager.getReader(this)
		}
	}

	async connect(type = 'All') {
		switch (type) {
			case 'All':
				await this.genWriter(this)
				await this.genReader(this)
				break
			case 'Writer':
				await this.genWriter(this)
				break
			case 'Reader':
				await this.genReader(this)
				break
		}

		return this
	}


	/**
		* @deprecated use `beginTransaction` for naming style
		*/
	async awaitTransaction() {
		await this.beginTransaction()
	}

	async beginTransaction(cb = () => { }) {
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
	*/
	query(sql, bb, cc) {
		let values = bb
		let cb = cc

		if (bb instanceof Function) {
			values = null
			cb = bb
		}

		this.q(sql, values)
			.then(data => cb(undefined, data))
			.catch(err => cb(err, undefined))
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

		this._status.querying = query.sql

		Event.emit('will_query', this.identity(), query.sql)

		const startTime = new Date()

		// Query
		mysqlConnection.querying = query.sql
		const { result, fields: _ } = await mysqlConnection.qV2(query)
		mysqlConnection.querying = undefined

		const endTime = new Date()

		//log
		const optionsString = [
			mustUpdateOneRow ? 'mustUpdateOneRow' : ''
		].join(',')

		const costTime = endTime - startTime
		const isLongQuery = endTime - launchTme > this._pool.options.QUERY_THRESHOLD_START && costTime > this._pool.options.QUERY_THRESHOLD_MS
		const printString = `${mysqlConnection.identity()} ${isLongQuery ? 'Long Query' : ''} ${costTime}ms: ${optionsString} ${query.sql}`

		if (isLongQuery) {
			Event.emit('log', 'Long Query', this.identity() + printString)
		} else if (print) {
			Event.emit('log', 'PRINT()', this.identity() + printString)
		} else {
			Event.emit('log', undefined, this.identity() + printString)
		}

		//emit
		Event.emit('did_query', this.identity(), query.sql)

		if (mustUpdateOneRow && result && result.affectedRows != 1) {
			throw Error(`MUST_UPDATE_ONE_ROW: ${query.sql}`)
		}

		this.resetStatus()

		return result
	}

	_queryMode({ EX, combine, queryKey } = {}) {
		if (!EX) {
			if (!combine) {
				return { Normal: true }
			} else if (Combine.isQuerying(queryKey)) { //查詢中則等結果
				return { WaitingCombine: true }
			}
			return { Combining: true }
		} else {
			//想要redis cache 卻沒有client
			if (!this._pool.redisClient) {
				return { Normal: true }
			}

			return { Caching: true }
		}
	}

	async q(sql, values, { key, EX, shouldRefreshInCache, redisPrint, combine } = {}) {

		const queryString = mysql.format((sql.sql || sql), values).replace(/\n/g, '')
		const queryKey = key || queryString
		const onErr = this._status.onErr

		try {
			const QueryMode = this._queryMode({ EX, combine, queryKey })

			switch (true) {
				case QueryMode.Normal: {
					return await this._q(sql, values)
				} case QueryMode.WaitingCombine: {
					return await Combine.subscribe(queryKey)
				} case QueryMode.Combining: {	//帶頭查

					Combine.bind(queryKey)
					const result = await this._q(sql, values)
					Combine.publish(queryKey, undefined, result)
					return result
				} case QueryMode.Caching: {

					//以下想要redis cache 且有client

					const someThing = await this._pool.redisClient.getJSONAsync(queryKey)

					//if cached
					const keepCache = shouldRefreshInCache ? !shouldRefreshInCache(someThing) : true
					if (someThing && keepCache) {
						if (redisPrint) {
							Event.emit('log', undefined, this.identity() + 'Cached in redis: true')
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
						Event.emit('log', undefined, this.identity() + 'Cached in redis: false ')
					}

					const toCache = (result === null) ? result : { isNull: true }

					await this._pool.redisClient.setJSONAsync(queryKey, toCache, 'EX', EX)

					Combine.publish(queryKey, undefined, result)
					return result
				}
				default:
					throw Error('wrong QueryMode')
			}
		} catch (error) {
			Combine.publish(queryKey, error, undefined)

			switch (true) {
				case typeof onErr == 'string':
					Event.emit('log', error, this.identity())
					throw Error(onErr)
				case typeof onErr == 'function':
					Event.emit('log', error, this.identity())
					throw Error(onErr(error))
				default:
					throw error
			}
		}
	}

	/**
	* @deprecated use `commitAsync()` for async/await
	*/
	commit(cb = () => { }) {
		this.commitAsync().then(r => cb(undefined, r)).catch(e => cb(e))
	}

	/**
	* @deprecated use `commitAsync()` for naming style
	*/
	async awaitCommit() {
		await this.commitAsync()
	}

	async commitAsync() {
		try {
			if (!this.writer) {
				Event.emit('log', undefined, this.identity() + `nothing : COMMIT`)
				return
			}

			const commitAsync = require('util').promisify(this.writer.commit)
			await commitAsync()
			Event.emit('log', undefined, this.identity() + `${this.writer.identity} : COMMIT`)
		} catch (error) {
			Event.emit('log', error, this.identity() + `${this.writer.identity} : COMMIT`)
		} finally {
			this._status.isCommitted = true
		}
	}

	async rollback() {
		if (!this.writer) {
			Event.emit('log', undefined, this.identity() + `nothing : ROLLBACK`)
			return
		}

		return new Promise(resolve => {
			const y = this.writer.rollback(() => {
				this._status.isCommitted = true
				Event.emit('log', undefined, this.identity() + `[${y._connection.threadId || 'default'}]  : ${y.sql}`)
				resolve()
			})
		})
	}

	release() {
		Event.emit('log', undefined, this.identity() + `RELEASE`)

		if (this._status.isStartedTransaction && !this._status.isCommitted) {
			Event.emit('log', Error('Transaction started, should be Committed before commit', this.identity()))
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

	isSelect(sql) {
		const command = (sql.sql || sql).trim().toLowerCase()

		return (/^select/i).test(command) && command.indexOf('for update') == -1
	}

	async _getReaderOrWriter(sql, useWriter) {
		if (this.isSelect(sql) && !useWriter) {
			if (!this.reader) {
				await this.connect('Reader')
			}
			return this.reader
		} else {
			if (!this.writer) {
				await this.connect('Writer')
			}
			return this.writer
		}
	}

	get forceWriter() {
		this._status.useWriter = true
		return this
	}

	get print() {
		this._status.print = true
		return this
	}

	get mustUpdateOneRow() {
		this._status.mustUpdateOneRow = true
		return this
	}

	onErr(callbackOrString) {
		this._status.onErr = callbackOrString
		return this
	}
}
