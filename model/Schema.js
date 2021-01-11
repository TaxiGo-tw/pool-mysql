const Types = require('./Types')
const Encryption = require('./Encryption')
const mysql = require('mysql')

const { Validator, throwError } = require('./Helper')
const { Type, Nested, Populate, Updated } = require('./Schema/')

module.exports = class Schema {
	constructor(dict) {
		if (dict) {
			for (const key in dict) {
				this[key] = dict[key]
			}
		} else {
			this._q = []
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

			this._q.push({ type: 'SELECT', command: `${keys}`, customed: true })
		}

		return this
	}

	FROM(table = this.constructor.name) {
		this._q.push({ type: 'FROM', command: `${table}` })
		return this
	}

	JOIN(whereCaluse, whereCaluse2) {
		const tableName = whereCaluse.split(' ')[0]
		for (const q of this._q) {
			if (q.type == 'SELECT') {
				if (q.customed) {
					q.command += `, ${tableName}.*`
				}
				break
			}
		}
		return addQuery.bind(this)('JOIN', whereCaluse, whereCaluse2, false)
	}

	LEFTJOIN(whereCaluse, whereCaluse2) {
		const tableName = whereCaluse.split(' ')[0]

		for (const q of this._q) {
			if (q.type == 'SELECT') {
				if (q.customed) {
					q.command += `, ${tableName}.*`
				}
				break
			}
		}
		return addQuery.bind(this)('LEFT JOIN', whereCaluse, whereCaluse2, false)
	}

	WHERE(whereCaluse, whereCaluse2) { return addQuery.bind(this)('WHERE', whereCaluse, whereCaluse2) }

	AND(whereCaluse, whereCaluse2, { isExec = true } = {}) {
		if (isExec) {
			return addQuery.bind(this)('AND', whereCaluse, whereCaluse2)
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

	OR(whereCaluse, whereCaluse2, { isExec = true } = {}) {
		if (isExec) {
			return addQuery.bind(this)('OR', whereCaluse, whereCaluse2)
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

	POPULATE(...fileds) {
		this._populadtes = fileds
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

	PRINT(options) {
		if (options == false) {
			this._print = false
			return this
		}

		this._print = true
		return this
	}

	ON_ERR(callbackOrString) {
		this._onErr = callbackOrString
		return this
	}


	WRITER() {
		this._forceWriter = true
		return this
	}

	NESTTABLES() {
		this._nestTables = true
		return this
	}

	MAP(mapCallback) {
		this._mapCallback = mapCallback
		return this
	}

	REDUCE(reduceCallback, reduceInitiVal = undefined) {
		this._reduceCallback = reduceCallback
		this._reduceInitiVal = reduceInitiVal
		return this
	}

	NESTED() {
		this._nested = true
		return this
	}

	EX(expireSecond, { key, forceUpdate = false, shouldRefreshInCache } = {}) {
		this._EX = {
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
			nestTables: this._nestTables || this._nested
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
			Schema._pool.logger('all', `${formatted}`)
		}

		return Schema._pool.mock(Schema._pool._mockCounter++, formatted)
	}

	async rollback(outSideConnection = null) {
		const connection = outSideConnection || await Schema._pool.createConnection()
		try {
			await connection.awaitTransaction()
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

	async exec(outSideConnection = null) {
		this._connection = outSideConnection || await Schema._pool.createConnection()
		try {
			let results

			///////////////////////////////////////////////////////////////////
			this._connection.useWriter = this._forceWriter
			this._forceWriter = false

			const {
				query,
				values,
				formatted,
				mapCallback,
				reduceCallback,
				reduceInitiVal,
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
				ex
			} = this._options()
			///////////////////////////////////////////////////////////////////
			if (this.shouldMock()) {
				return this.mocked(formatted)
			}
			///////////////////////////////////////////////////////////////////

			// eslint-disable-next-line no-unused-vars
			let conn = this._connection
			if (print) {
				conn = conn.print
			}

			if (onErr) {
				conn = conn.onErr(onErr)
			}

			results = await conn.q(query, values, ex)

			decryption.forEach(column => {
				results.forEach((result) => {
					if (result[column]) {
						result[column] = Encryption.decrypt(result[column])
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
			if (this._connection.isSelect(query.sql)) {
				//populate
				if (populates.length && results.length) {
					results = await Populate.find({ this: this, results, populates, print, Schema })
				}

				//for MAP()
				if (mapCallback) {
					results = results.map(mapCallback)
				}

				if (reduceCallback) {
					results = results.reduce(reduceCallback, reduceInitiVal)
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
				this._connection.release()
			}
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

	SET(whereCaluse, whereCaluse2, { passUndefined = false, encryption = [] } = {}) {

		if (typeof whereCaluse === 'object') {
			Validator.validate.bind(this)(whereCaluse)

			for (const key of Object.keys(whereCaluse)) {
				if (this.columns && this.columns[key] && this.columns[key].type && this.columns[key].type.inputMapper) {
					const { inputMapper } = this.columns[key].type
					whereCaluse[key] = inputMapper(whereCaluse[key])
				}
			}
		}

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

		function encryptIfNeeded(encryption, value) {
			if (!(value instanceof Object) || !encryption.length) {
				return value
			}

			const result = JSON.parse(JSON.stringify(value))
			encryption.forEach(column => {
				Object.keys(result).forEach((key) => {
					if (key === column) {
						result[key] = Encryption.encrypt(result[key])
					}
				})
			})
			return result
		}

		if (whereCaluse instanceof Object) {
			let value = passUndefinedIfNeeded(passUndefined, whereCaluse)
			value = encryptIfNeeded(encryption, whereCaluse)
			this._q.push({ type: 'SET', command: '?', value })
			return this
		}

		let value = passUndefinedIfNeeded(passUndefined, whereCaluse2)
		value = encryptIfNeeded(encryption, whereCaluse2)
		return addQuery.bind(this)('SET', whereCaluse, value, false)
	}

	VALUES(values) {
		if (values instanceof Array) {
			const command = values.map(value => {
				return `('${value.join(`','`)}')`
			}).join(',')

			this._q.push({ type: 'VALUES', command })
			return this
		} else {
			throwError(`${this.constructor.name} values is not an array`)
		}
	}

	DUPLICATE(whereCaluse, whereCaluse2) {
		if (whereCaluse instanceof Object) {
			this._q.push({ type: 'ON DUPLICATE KEY', command: 'UPDATE ?', value: whereCaluse })
			return this
		}

		return addQuery.bind(this)('ON DUPLICATE KEY UPDATE', whereCaluse, whereCaluse2, false)
	}

	FIRST() {
		this._getFirst = true
		addQuery.bind(this)('LIMIT', 1, null)
		return this
	}

	static FIND(...whereCaluse) {
		const object = new this()
		return object.SELECT().FROM().WHERE(...whereCaluse)
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
		this._filter = callback
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
		this._decryption = decryption
		return this
	}

	COMBINE() {
		this._combine = true
		return this
	}

	UPDATED(...variables) {
		this._updated = true

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
		this._changedRows = changedRows
		return this
	}

	AFFECTED_ROWS(affectedRows) {
		this._affectedRows = affectedRows
		return this
	}

	_options() {
		const options = {}

		const formatted = this.FORMATTED()
		options.query = formatted.query
		options.values = formatted.values
		options.formatted = formatted.formatted

		delete this._nestTables

		options.mapCallback = this._mapCallback
		delete this._mapCallback

		options.reduceCallback = this._reduceCallback
		delete this._reduceCallback

		options.reduceInitiVal = this._reduceInitiVal
		delete this._reduceInitiVal

		options.nested = this._nested
		this._nested = false

		options.print = this._print
		this._print = false

		options.filter = this._filter
		delete this._filter

		options.getFirst = this._getFirst
		delete this._getFirst

		options.updated = this._updated
		delete this._updated

		options.changedRows = this._changedRows
		delete this._changedRows

		options.affectedRows = this._affectedRows
		delete this._affectedRows

		options.onErr = this._onErr
		delete this._onErr

		options.decryption = this._decryption || []
		delete this._decryption

		options.populates = this._populadtes || []
		delete this._populadtes

		const combine = this._combine || false
		delete this._combine

		options.ex = this._EX || { combine }
		options.ex.redisPrint = options.print
		this._EX = {}

		return options
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

function addQuery(reservedWord, whereCaluse, whereCaluse2, inBrackets = true) {
	if (!whereCaluse) {
		return this
	}

	if (typeof whereCaluse == 'string') {
		if (inBrackets) {
			this._q.push({ type: reservedWord, command: `(${whereCaluse})`, value: whereCaluse2 })
		} else {
			this._q.push({ type: reservedWord, command: `${whereCaluse}`, value: whereCaluse2 })
		}
	} else if (typeof whereCaluse == 'object') {
		this._q.push({ type: reservedWord, command: `(?)`, value: whereCaluse })
	} else {
		this._q.push({ type: reservedWord, command: `?`, value: whereCaluse })
	}

	return this
}

////////////////////////////////////////////////////////////
