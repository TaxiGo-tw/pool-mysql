const pool = require('./Pool')
const Types = require('./Types')
const mysql = require('mysql')

module.exports = class Base {
	constructor(dict) {
		if (dict) {
			for (const key in dict) {
				this[key] = dict[key]
			}
		}

		this._queryValues = []
		this._query = ''

		this._populadtes = []

		this._q = []

		// this._q.map(q => q.query).join(' ')
		// this._q.flatMap(q => q.values)
	}

	static async native(outSideConnection, sql, values) {
		if (!sql) {
			throw 'sql command needed'
		}

		this._connection = outSideConnection || await pool.createConnection()

		try {
			return await this._connection.q(sql, values)
		} catch (error) {
			throw error
		} finally {
			if (!outSideConnection) {
				this._connection.release()
			}
		}
	}

	EXPLAIN() {
		this._q.splice(0, 0, { type: 'EXPLAIN' })
		// this._query
		return this
	}

	static SELECT(columns = null) {
		const object = new this()
		return object.SELECT(columns)
	}

	SELECT(columns = null) {
		switch (columns) {
			case null: {
				const keys = this.columns
					? Object.keys(this.columns)
						.filter(column => !(this.columns[column] instanceof Array) && !(typeof this.columns[column] == 'object'))
						.map(column => `${this.constructor.name}.${column}`)
						.join(', ')
					: '*'

				this._q.push({ type: 'SELECT', command: `${keys}` })
				break
			}
			default: {
				const fields = columns.split(',').map(c => {
					if (c.includes('.')) {
						return c
					}

					return `${this.constructor.name}.${c}`
				}).join(', ')

				this._q.push({ type: 'SELECT', command: `${fields}` })
			}

		}

		return this
	}

	SQL_NO_CACHE() {
		this._q.push({ type: 'SQL_NO_CACHE' })
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
				q.command += `, ${tableName}.*`
				break
			}
		}
		return addQuery.bind(this)('JOIN', whereCaluse, whereCaluse2, false)
	}

	LEFTJOIN(whereCaluse, whereCaluse2) {
		const tableName = whereCaluse.split(' ')[0]
		for (const q of this._q) {
			if (q.type == 'SELECT' && !q.value) {
				q.command += `, ${tableName}.*`
				break
			}
		}
		return addQuery.bind(this)('LEFT JOIN', whereCaluse, whereCaluse2, false)
	}
	WHERE(whereCaluse, whereCaluse2) { return addQuery.bind(this)('WHERE', whereCaluse, whereCaluse2) }
	AND(whereCaluse, whereCaluse2) { return addQuery.bind(this)('AND', whereCaluse, whereCaluse2) }
	OR(whereCaluse, whereCaluse2) { return addQuery.bind(this)('OR', whereCaluse, whereCaluse2) }
	HAVING(whereCaluse, whereCaluse2) { return addQuery.bind(this)('HAVING', whereCaluse, whereCaluse2) }

	ORDER_BY(column, sort = 'ASC') {
		if (column) {
			this._q.push({ type: 'ORDER BY', command: `${column} ${sort}` })
		}
		return this
	}

	LIMIT(numbers) {
		if (numbers) {
			this._q.push({ type: 'LIMIT', command: `${numbers}` })
		}
		return this
	}

	OFFSET(numbers) {
		if (numbers) {
			this._q.push({ type: 'OFFSET', command: `${numbers}` })
		}
		return this
	}

	POPULATE(...fileds) {
		this._populadtes = fileds
		return this
	}

	INSERT(ignore = false) {
		const ig = ignore ? 'IGNORE' : ''
		this._q.push({ type: 'INSERT', command: `${ig}` })
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

	PRINT() {
		this._print = true
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

	MAPPED() {
		this._mapped = true
		return this
	}

	EX(expireSecond, cacheKey) {
		this._EX = { key: cacheKey, EX: expireSecond }
		return this
	}

	async exec(outSideConnection = null) {
		this._connection = outSideConnection || await pool.createConnection()
		try {
			let results

			this._connection.useWriter = this._forceWriter
			this._forceWriter = false

			const query = {
				sql: this._q.map(q => `${q.type} ${q.command}`).join(' '),
				nestTables: this._nestTables || this._mapped
			}
			this._nestTables = false

			const values = this._q.map(q => q.value).filter(q => q)

			const ex = this._EX
			this._EX = {}

			console.log(this._q)
			console.log(query)
			console.log(values)

			// console.log(this._q)
			// console.log(values)
			// console.log(query)
			// console.log(mysql.format(query.values))


			if (this._print) {
				this._print = false
				results = await this._connection.print.q(query, values, ex)
			} else {
				results = await this._connection.q(query, values, ex)
			}

			if (this._connection.isSelect(query.sql)) {
				//populate
				if (this._populadtes.length && results.length) {

					for (let i = 0; i < this._populadtes.length; i++) {
						const column = this._populadtes[i]
						const populateType = this.columns[column]
						if (populateType instanceof Array) {//coupons: [Coupons]
							const type = populateType[0]

							const tColumn = Object.keys(type.columns).filter(c => type.columns[c].name == this.constructor.name)[0]

							const PKColumn = Object.keys(this.columns).filter(column => this.columns[column] == Base.Types.PK)[0]
							const ids = results.map(result => result[PKColumn])
							const populates = await type.SELECT().FROM().WHERE(`${tColumn} in (${ids})`).exec(this._connection)

							results.forEach(result => {
								result[column] = populates.filter(p => p[tColumn] == result[PKColumn])
							})
						} else {// coupon: Coupons
							let ids
							let refType = populateType
							let refColumn = column

							if (results instanceof Array) {
								if (typeof populateType == 'object') {
									// {
									// 	ref: require('...')
									// 	column:...
									// }
									refColumn = populateType.column
									refType = populateType.ref
									ids = results.filter(result => result[refColumn]).map(result => result[refColumn])
								} else {
									ids = results.filter(result => result[refColumn]).map(result => result[refColumn])
								}

								if (!ids.length) {
									continue
								}
							} else if (results && results[refColumn]) {
								ids = [results[refColumn]]
								if (!ids) {
									continue
								}
							} else {
								continue
							}

							const PKColumn = Object.keys(refType.columns).filter(column => refType.columns[column] == Base.Types.PK)[0]
							const populates = await refType.SELECT().FROM().WHERE(`${PKColumn} IN (${ids})`).exec(this._connection)

							results = results.map(result => {
								if (result[refColumn]) {
									result[column] = populates.filter(populate => result[refColumn] == populate[PKColumn])[0] || result[refColumn]
								}
								return result
							})
						}
					}
				}


				//for MAP()
				if (this._mapCallback) {
					const cb = this._mapCallback
					delete this._mapCallback
					results = results.map(cb)
				}
			}

			results = results.map(result => new this.constructor(result))
			results.forEach(this.constructor.REMOVE_PRIVATE_VARIABLE)

			return results
		} catch (error) {
			throw error
		} finally {
			if (!outSideConnection) {
				this._connection.release()
			}
		}
	}

	static REMOVE_PRIVATE_VARIABLE(t) {
		delete t._populadtes
		delete t._query
		delete t._queryValues
		delete t._q
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
	static UPDATE() {
		const object = new this()
		return object.UPDATE()
	}

	UPDATE() {
		this._query = `UPDATE ${this.constructor.name}`
		return this
	}

	SET(value) {
		this._query += ' SET ? '
		this._queryValues.push(value)
		return this
	}

	DUPLICATE(set) {
		this._query += ' ON DUPLICATE KEY UPDATE ? '
		this._queryValues.push(set)
		return this
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
	} else {
		this._q.push({ type: reservedWord, command: `?`, value: whereCaluse })
	}

	return this
}