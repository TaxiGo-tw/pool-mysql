const launchTme = new Date()

const mysql = require('mysql')
const Event = require('./Logger/Event')

const Combine = require('./Schema/Combine')

module.exports = class Connection {
	constructor(pool) {
		this._pool = pool

		this.useWriter = pool.options.forceWriter

		this.tag = {
			name: 'default',
			limit: this._pool.options.connectionLimit
		}

		this.gotAt = new Date()

		this.resetStatus()
	}

	resetStatus() {
		this._status = {
			useWriter: this._pool.options.forceWriter,
			print: false,
			mustUpdateOneRow: false,
			onErr: undefined
		}
	}

	async connect(type = 'All') {
		const manager = this._pool._mysqlConnectionManager

		switch (type) {
			case 'All':
				this.writer = await manager.getWriter(this)
				this.reader = await manager.getReader(this)
				break
			case 'Writer':
				this.writer = await manager.getWriter(this)
				break
			case 'Reader':
				this.reader = await manager.getReader(this)
				break
		}

		return this
	}


	/**
		* @deprecated use `beginTransaction`
		*/
	async awaitTransaction() {
		await this.beginTransaction()
	}

	async beginTransaction(cb = () => { }) {
		try {
			if (!this.writer) {
				this.writer = await this._pool._mysqlConnectionManager.getWriter(this)
			}

			await this.writer.beginTransactionAsync()
			this._status.isStartedTransaction = true
			cb(undefined)
		} catch (e) {
			console.log(e)
			cb(e)
		}
	}

	/**
	* @deprecated use `q()`
	*/
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
		const sqlStatement = sql.sql || sql

		// is pool.mock available
		if (process.env.NODE_ENV !== 'production' && this._pool.mock && !isNaN(this._pool._mockCounter)) {
			return this._pool.mock(this._pool._mockCounter++, sqlStatement)
		}

		const { useWriter, print, mustUpdateOneRow } = this._status
		this.resetStatus()

		const mysqlConnection = await this.getReaderOrWriter(sql, useWriter)

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

		const queryString = mysql.format((sql.sql || sql), values).split('\n').join(' ')
		const queryKey = key || queryString
		const onErr = this._status.onErr

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
					Event.emit('log', error)
					throw Error(onErr)
				case typeof onErr == 'function':
					Event.emit('log', error)
					throw Error(onErr(error))
				default:
					throw error
			}
		}
	}

	/**
	* @deprecated use `commitAsync()`
	*/
	commit(cb = () => { }) {
		this.awaitCommit().then(cb).catch(cb)
	}

	/**
	* @deprecated use `commitAsync()`
	*/
	async awaitCommit() {
		await this.commitAsync()
	}

	async commitAsync() {
		const commitAsync = require('util').promisify(this.writer.commit)

		try {
			await commitAsync()
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
		Event.emit('log', undefined, `[${this.id}] RELEASE`)

		if (this._status.isStartedTransaction && !this._status.isCommitted) {
			Event.emit('log', Error('Transaction started, should be Committed before commit'))
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
		Event.emit('end', this)

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

	async getReaderOrWriter(sql, useWriter) {
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
