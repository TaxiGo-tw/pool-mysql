const Types = require('./Schema/Types')
const Encryption = require('./Schema/Encryption')
const mysql = require('mysql')

const { Validator, throwError } = require('./Helper')
const { Type, Nested, Populate, Updated } = require('./Schema/')

const Event = require('./Logger/Event')

module.exports = class Schema {
	constructor(dict) {
		if (dict) {
			for (const key in dict) {
				this[key] = dict[key]
			}
		} else {
			this._q = []
			this._resetQueryOptions()
		}
	}

	static get _pool() {
		return require('./Pool')
	}

	static async native(outSideConnection, sql, values) {
		if (!sql) {
			throwError('sql command needed')
		}

		const connection = outSideConnection || await Schema._pool.createConnection()

		try {
			return await connection.q(sql, values)
		} catch (error) {
			throwError(error)
		} finally {
			if (!outSideConnection) {
				connection.release()
			}
		}
	}

	static get KEYS() {
		const object = new this()
		const columns = object.columns

		return Object.keys(columns)
			.filter(column => Type.isRealColumn(columns[column]))
			.map(column => `${object.constructor.name}.${column}`)
	}

	// EXPLAIN() {
	// 	this._q.push({ type: 'EXPLAIN', command: null, value: null })
	// 	return this
	// }

	static SELECT(...columns) {
		const object = new this()
		return object.SELECT(columns)
	}

	SELECT(columns = []) {
		if (columns.length && columns[0].includes('?')) {
			this._q.push({ type: 'SELECT', command: columns[0], value: columns[1] })
		}
		else if (columns.length && columns.length == 1) {
			this._q.push({ type: 'SELECT', command: columns })
		} else if (columns.length) {
			const fields = columns.join(',').split(',').map(c => {
				if (c.includes('.')) {
					return c
				}

				return `${this.constructor.name}.${c}`
			}).join(', ')
			this._q.push({ type: 'SELECT', command: fields })
		} else {
			const keys = this.columns
				? Object.keys(this.columns)
					.filter(column => {
						if (this.columns[column].type) {
							return true
						}

						return !(this.columns[column] instanceof Array) && !(typeof this.columns[column] == 'object')
					})
					.map(column => `${this.constructor.name}.${column}`)
					.join(', ')
				: '*'

			this._q.push({ type: 'SELECT', command: `${keys}`, costumed: true })
		}

		return this
	}

	FROM(table = this.constructor.name) {
		this._q.push({ type: 'FROM', command: `${table}` })
		return this
	}

	JOIN(whereClause, whereClause2) {
		const tableName = whereClause.split(' ')[0]
		for (const q of this._q) {
			if (q.type == 'SELECT') {
				if (q.costumed) {
					q.command += `, ${tableName}.*`
				}
				break
			}
		}
		return addQuery.bind(this)('JOIN', whereClause, whereClause2, false)
	}

	LEFTJOIN(whereClause, whereClause2) {
		const tableName = whereClause.split(' ')[0]

		for (const q of this._q) {
			if (q.type == 'SELECT') {
				if (q.costumed) {
					q.command += `, ${tableName}.*`
				}
				break
			}
		}
		return addQuery.bind(this)('LEFT JOIN', whereClause, whereClause2, false)
	}

	WHERE(whereClause, whereClause2) { return addQuery.bind(this)('WHERE', whereClause, whereClause2) }

	AND(whereClause, whereClause2, { isExec = true } = {}) {
		if (isExec) {
			return addQuery.bind(this)('AND', whereClause, whereClause2)
		}
		return this
	}

	WHERE_AND(obj) {
		if (typeof obj !== 'object') {
			throw 'WHERE_CLAUSE must input object'
		}

		let result = this.WHERE('1=1')
		for (const key in obj) {
			const value = obj[key]
			result = result.AND({ [key]: value })
		}
		return result
	}

	OR(whereClause, whereClause2, { isExec = true } = {}) {
		if (isExec) {
			return addQuery.bind(this)('OR', whereClause, whereClause2)
		}

		return this
	}

	HAVING(...column) { return addQuery.bind(this)('HAVING', column.join(' AND '), null) }
	GROUP_BY(...column) { return addQuery.bind(this)('GROUP BY', column.join(', '), null, false) }
	ORDER_BY(column, sort = 'ASC') { return addQuery.bind(this)('ORDER BY ', `${column} ${sort}`, null, false) }

	LIMIT(numbers, defaultValue = 20, { isExec = true } = {}) {
		if (isExec) {
			const limit = numbers ? parseInt(numbers) : defaultValue
			return addQuery.bind(this)('LIMIT', limit, null)
		}

		return this
	}

	OFFSET(numbers, defaultValue = 0, { isExec = true } = {}) {
		if (isExec) {
			const limit = numbers ? parseInt(numbers) : defaultValue
			return addQuery.bind(this)('OFFSET', limit, null)
		}
		return this
	}

	POPULATE(...fields) {
		this._queryOptions.populates = fields
		return this
	}

	INSERT(ignore = false) {
		const ig = ignore ? 'IGNORE' : ''
		this._q.push({ type: `INSERT`, command: ig })
		return this
	}

	static INSERT(ignore = false) {
		const object = new this()
		return object.INSERT(ignore)
	}

	INTO(table = this.constructor.name) {
		this._q.push({ type: 'INTO', command: `${table}` })
		return this
	}

	static DELETE() {
		const object = new this()
		return object.DELETE()
	}

	DELETE() {
		this._q.push({ type: 'DELETE' })
		return this
	}

	PRINT(option = true) {
		this._queryOptions.print = option
		return this
	}

	ON_ERR(callbackOrString) {
		this._queryOptions.onErr = callbackOrString
		return this
	}


	WRITER(useWriter = true) {
		this._queryOptions.useWriter = useWriter
		return this
	}

	NESTTABLES() {
		this._nestTables = true
		return this
	}

	MAP(mapCallback) {
		this._queryOptions.mapCallback = mapCallback
		return this
	}

	REDUCE(reduceCallback, reduceInitVal = undefined) {
		this._queryOptions.reduceCallback = reduceCallback
		this._queryOptions.reduceInitVal = reduceInitVal
		return this
	}

	NESTED() {
		this._queryOptions.nested = true
		return this
	}

	EX(expireSecond, { key, forceUpdate = false, shouldRefreshInCache } = {}) {
		this._queryOptions.EX = {
			key,
			EX: expireSecond,
			shouldRefreshInCache: forceUpdate ? () => { return forceUpdate } : shouldRefreshInCache,
			redisPrint: this._print
		}

		return this
	}

	FORMATTED(formatted = true) {
		const pre = this._pre || ''
		delete this._pre

		const after = this._after || ''
		delete this._after

		const query = {
			sql: pre + this._q.map(q => `${q.type || ''} ${q.command || ''}`).join(' ') + after,
			nestTables: this._nestTables || this._queryOptions.nested
		}

		const values = this._q
			.filter(q => ((q.command && q.command.includes('?')) || q.value))
			.map(q => q.value)
			.reduce((q, b) => q.concat(b), [])

		return {
			query,
			values,
			formatted: formatted
				? mysql.format(query.sql, values)
				: null
		}
	}

	shouldMock() {
		return Schema._pool.mock && !isNaN(Schema._pool._mockCounter)
	}

	mocked(formatted) {
		if (this._print) {
			Event.emit('log', 'all', `${formatted}`)
		}

		return Schema._pool.mock(Schema._pool._mockCounter++, formatted)
	}

	async rollback(outSideConnection = null) {
		const connection = outSideConnection || Schema._pool.connection()
		try {
			await connection.beginTransaction()
			return await this.exec(connection)
		} catch (error) {
			throwError(error)
		} finally {
			await connection.rollback()
			if (!outSideConnection) {
				connection.release()
			}
		}
	}

	async exec(outSideConnection = null, options) {
		const connection = outSideConnection || Schema._pool.connection(options)
		try {
			let results

			///////////////////////////////////////////////////////////////////
			const {
				query,
				values,
				formatted,
				mapCallback,
				reduceCallback,
				reduceInitVal,
				nested,
				print,
				filter,
				getFirst,
				updated,
				changedRows,
				affectedRows,
				onErr,
				decryption,
				populates,
				ex,
				useWriter,
				encryption
			} = this._options()
			///////////////////////////////////////////////////////////////////
			if (this.shouldMock()) {
				return this.mocked(formatted)
			}
			///////////////////////////////////////////////////////////////////

			connection._status.useWriter = (connection._status.useWriter || useWriter)

			// eslint-disable-next-line no-unused-vars
			let conn = connection
			if (print) {
				conn = conn.print
			}

			if (onErr) {
				conn = conn.onErr(onErr)
			}

			//encryption
			encryption.forEach(column => {
				this._q
					.filter(q => q.type === 'SET' && q.value instanceof Object)
					.forEach(q => {
						if (q.value[column]) {
							const key = conn._pool.options.DATA_ENCRYPTION_KEY
							const iv = conn._pool.options.DATA_ENCRYPTION_IV
							q.value[column] = Encryption.encrypt(q.value[column], { key, iv })
						}
					})
			})

			///////////////////////////////////////////////////////////////////
			results = await conn.q(query, values, ex)
			///////////////////////////////////////////////////////////////////

			//decryption
			decryption.forEach(column => {
				results.forEach((result) => {
					if (result[column]) {
						const key = conn._pool.options.DATA_ENCRYPTION_KEY
						const iv = conn._pool.options.DATA_ENCRYPTION_IV
						result[column] = Encryption.decrypt(result[column], { key, iv })
					}
				})
			})

			// check changedRows && affectedRows
			const ch = updated ? results[1] : results
			if (changedRows != undefined && changedRows != ch.changedRows) {
				throwError(`changedRows did set to ${changedRows}, but ${ch.changedRows}`, onErr)
			} else if (affectedRows != undefined && affectedRows != ch.affectedRows) {
				throwError(`affectedRows did set to ${affectedRows}, but ${ch.affectedRows}`, onErr)
			}

			//SELECT()
			if (connection.isSelect(query.sql)) {
				//populate
				if (populates.length && results.length) {
					results = await Populate.find({ this: this, results, populates, print, Schema })
				}

				//for MAP()
				if (mapCallback) {
					results = results.map(mapCallback)
				}

				if (reduceCallback) {
					results = results.reduce(reduceCallback, reduceInitVal)
				}

				if (nested) {
					const mapped = results.map(Nested.mapper.bind(this))
					if (typeof mapped === 'object') {
						results = new this.constructor(mapped)
					} else {
						results = mapped
					}
				} else if (results.length && typeof results[0] === 'object') {
					results = results.map(result => new this.constructor(result))
				}

				if (filter) {
					results = results.filter(filter)
				}

				if (getFirst) {
					return results[0]
				}
			}
			//select with query
			else if (updated) {
				return Updated.handler({ results, filter, getFirst })
			}

			return results
		} catch (error) {
			throwError(error)
		} finally {
			if (!outSideConnection) {
				connection.release()
			}
		}
	}

	//select only
	async readableStream({ connection: outSideConnection, res }) {
		const stream = require('stream')

		const pool = Schema._pool
		const connection = outSideConnection || pool.connection()

		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Cache-Control', 'no-cache')

		try {
			const options = this._options()
			const { formatted, print } = options

			// for (const key of Object.keys(options)) {
			// 	if (options[key] && ['query', 'values', 'formatted', 'print'].includes(key) == false) {
			// 		throwError(`function '${key}' is not support in stream() `)
			// 	}
			// }

			if (!connection.isSelect(formatted)) {
				throwError(`'Stream query' must be SELECT, but "${formatted}"`)
			}

			if (print) {
				Event.emit('log', connection.identity(), formatted)
			}

			connection.querying = formatted

			await connection.genReader()

			connection.reader
				.query(formatted)
				.stream()
				.pipe(stream.Transform({
					objectMode: true,
					transform: (data, encoding, callback) => {
						try {
							res.write(JSON.stringify(data))
						} catch (error) { }

						callback()
					}
				}))
				.on('finish', () => {
					res.end()

					delete connection.querying

					if (!connection) {
						connection.release()
					}
				})

		} catch (error) {
			delete connection.querying

			res.write(JSON.stringify({ msg: error.message }))
			res.end()
			res.status(400).send()
			if (!outSideConnection) {
				connection.release()
			}

			throwError(error)
		}
	}


	get JSON() {
		return this
	}

	get PRIVATE() {
		return this
	}

	static get columns() {
		const instance = new this()
		if (instance.columns) {
			return instance.columns
		}
		return {}
	}

	static get Types() { return Types }

	//////////////////////////////Base.js
	//UPDATE
	static UPDATE(table) {
		const object = new this()
		return object.UPDATE(table)
	}

	UPDATE(table = this.constructor.name) {
		if (!this._q) {
			this._q = []
		}

		this._q.push({ type: 'UPDATE', command: table })
		return this
	}

	SET(whereClause, whereClause2, { passUndefined = false, encryption = [] } = {}) {
		function passUndefinedIfNeeded(passUndefined, value) {
			if (!passUndefined || !(value instanceof Object)) {
				return value
			}

			const result = JSON.parse(JSON.stringify(value))
			for (const key in Object.keys(result)) {
				if (result[key] === undefined) {
					delete result[key]
				}
			}
			return result
		}

		//inputMapper
		if (typeof whereClause === 'object') {
			Validator.validate.bind(this)(whereClause)

			for (const key of Object.keys(whereClause)) {
				if (this.columns && this.columns[key] && this.columns[key].type && this.columns[key].type.inputMapper) {
					const { inputMapper } = this.columns[key].type
					whereClause[key] = inputMapper(whereClause[key])
				}
			}
		}

		this._queryOptions.encryption = encryption

		//pre handle
		if (whereClause instanceof Object) {
			const value = passUndefinedIfNeeded(passUndefined, whereClause)
			this._q.push({ type: 'SET', command: '?', value })
			return this
		} else {
			const value = passUndefinedIfNeeded(passUndefined, whereClause2)
			return addQuery.bind(this)('SET', whereClause, value, false)
		}
	}

	VALUES(values) {
		if (!(values instanceof Array)) {
			throwError(`${this.constructor.name} values is not an array`)
		}

		this._q.push({
			type: 'VALUES',
			value: values.reduce((a, b) => a.concat(b), []),
			command: values.map(value => `(${value.map(_ => '?').join(`,`)})`).join(',')
		})
		return this
	}

	DUPLICATE(whereClause, whereClause2) {
		if (whereClause instanceof Object) {
			this._q.push({ type: 'ON DUPLICATE KEY', command: 'UPDATE ?', value: whereClause })
			return this
		}

		return addQuery.bind(this)('ON DUPLICATE KEY UPDATE', whereClause, whereClause2, false)
	}

	FIRST() {
		this._queryOptions.getFirst = true
		addQuery.bind(this)('LIMIT', 1, null)
		return this
	}

	static FIND(...whereClause) {
		const object = new this()
		return object.SELECT().FROM().WHERE(...whereClause)
	}

	static FIND_PK(pk) {
		if (!this.columns) {
			throwError(`${this.constructor.name} columns not defined`)
		}

		const find = this._pk

		if (!find) {
			throwError(`${this.constructor.name}.PK columns not defined`)
		}

		return this.SELECT().FROM().WHERE(`${find} = ?`, pk).FIRST()
	}

	FILTER(callback) {
		this._queryOptions.filter = callback
		return this
	}

	async save() {
		const pk = this._pk

		const value = JSON.parse(JSON.stringify(this))
		delete value[pk]

		const where = {}
		where[pk] = this[pk]

		await this.UPDATE().SET(value).WHERE(where).exec()
	}

	static get _pk() {
		const x = new this()
		return x._pk
	}

	get _pk() {
		if (!this.columns) {
			throwError(`${this.constructor.name} columns not defined`)
		}

		let pk
		for (const key in this.columns) {
			const value = Type.realType(this.columns[key])
			if (Type.isInherit(value, Schema.Types.PK)) {
				pk = key
			}
		}

		if (!pk) {
			throwError(`${this.constructor.name}.PK columns not defined`)
		}

		return pk
	}

	_PRE(command) {
		this._pre = command + ';'
		return this
	}

	_AFTER(command) {
		this._after = ';' + command
		return this
	}

	DECRYPT(...decryption) {
		this._queryOptions.decryption = decryption
		return this
	}

	COMBINE() {
		this._queryOptions.combine = true
		return this
	}

	UPDATED(...variables) {
		this._queryOptions.updated = true

		let obj = this

		for (const i in variables) {
			const variable = variables[i]

			// updated字串 + 1就會過喔 (不知道為啥)
			obj = obj.AND(`(SELECT @${variable} := CONCAT_WS(',', IF(${variable} IS NULL, "{{NULL}}",${variable}), @${variable})) + 1`)
		}

		const preParams = variables.map(r => `@${r} := ''`).join(',')
		obj = obj._PRE(`SET ${preParams}`)

		const queryParams = variables.map(r => `@${r} ${r}`).join(',')
		return obj._AFTER(`SELECT ${queryParams}`)
	}

	CHANGED_ROWS(changedRows) {
		this._queryOptions.changedRows = changedRows
		return this
	}

	AFFECTED_ROWS(affectedRows) {
		this._queryOptions.affectedRows = affectedRows
		return this
	}

	_options() {
		const queryOptions = this._queryOptions
		const { query, values, formatted } = this.FORMATTED()

		const options = {
			query,
			values,
			formatted,

			mapCallback: queryOptions.mapCallback,
			reduceCallback: queryOptions.reduceCallback,
			reduceInitVal: queryOptions.reduceInitVal,
			nested: queryOptions.nested,
			print: queryOptions.print,

			filter: queryOptions.filter,
			getFirst: queryOptions.getFirst,
			updated: queryOptions.updated,
			changedRows: queryOptions.changedRows,
			affectedRows: queryOptions.affectedRows,
			onErr: queryOptions.onErr,
			decryption: queryOptions.decryption || [],
			populates: queryOptions.populates || [],
			useWriter: queryOptions.useWriter || false,
			encryption: queryOptions.encryption || [],
			ex: {
				...queryOptions.EX || { combine: queryOptions.combine || false },
				...{ redisPrint: queryOptions.print }
			}
		}

		this._resetQueryOptions()
		delete this._nestTables

		return options
	}

	_resetQueryOptions() {
		this._queryOptions = {
			decryption: [],
			populates: [],
			useWriter: false,
			encryption: [],
		}
	}

	validate(isInsert) {
		const columns = this.columns

		//columns not defined
		if (!columns) {
			return true
		}

		for (const [key, option] of Object.entries(columns)) {
			// pass if not defined
			if (typeof option !== 'object') {
				continue
			}

			const value = this[key]

			//detect if required
			Validator.required.bind(this)({ key, value, option, isInsert })

			//throw if invalid
			const { type } = option
			if (type) {
				const typeValidator = type.validate
				if (value !== undefined && value !== null && typeValidator && !typeValidator(value)) {
					throwError(`${this.constructor.name}.${key} must be type: '${type.name}', not '${typeof value}' ${JSON.stringify(this)}`)
				}
			}

			//detect length
			Validator.length.bind(this)({ key, value, option })
		}

		return true
	}
}

function addQuery(reservedWord, whereClause, whereClause2, inBrackets = true) {
	if (!whereClause) {
		return this
	}

	if (typeof whereClause == 'string') {
		if (inBrackets) {
			this._q.push({ type: reservedWord, command: `(${whereClause})`, value: whereClause2 })
		} else {
			this._q.push({ type: reservedWord, command: `${whereClause}`, value: whereClause2 })
		}
	} else if (typeof whereClause == 'object') {
		this._q.push({ type: reservedWord, command: `(?)`, value: whereClause })
	} else {
		this._q.push({ type: reservedWord, command: `?`, value: whereClause })
	}

	return this
}

////////////////////////////////////////////////////////////
