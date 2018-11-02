const pool = require('./Pool')
const Types = require('./Types')

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
						.join(', ')
					: '*'

				this._query = `SELECT ${keys} `
				break
			}
			case '*':
				this._query = 'SELECT * '
				break
			default:
				this._query = `SELECT ${columns} `
		}

		return this
	}

	SQL_NO_CACHE() {
		this._query += ' SQL_NO_CACHE '
		return this
	}

	FROM(table = this.constructor.name) {
		this._query += ` FROM ${table} `
		return this
	}

	JOIN(whereCaluse, whereCaluse2) { return addQuery.bind(this)('JOIN', whereCaluse, whereCaluse2, false) }
	LEFTJOIN(whereCaluse, whereCaluse2) { return addQuery.bind(this)('LEFT JOIN', whereCaluse, whereCaluse2, false) }
	WHERE(whereCaluse, whereCaluse2) { return addQuery.bind(this)('WHERE', whereCaluse, whereCaluse2) }
	AND(whereCaluse, whereCaluse2) { return addQuery.bind(this)('AND', whereCaluse, whereCaluse2) }
	OR(whereCaluse, whereCaluse2) { return addQuery.bind(this)('OR', whereCaluse, whereCaluse2) }
	HAVING(whereCaluse, whereCaluse2) { return addQuery.bind(this)('HAVING', whereCaluse, whereCaluse2) }

	ORDER_BY(column, sort = 'ASC') {
		if (column) {
			this._query += ` ORDER BY ${column} ${sort}`
		}
		return this
	}

	LIMIT(numbers) {
		if (numbers) {
			this._query += ` LIMIT ${numbers} `
		}
		return this
	}

	POPULATE(...fileds) {
		this._populadtes = fileds
		return this
	}

	INSERT(ignore = false) {
		this._query = `INSERT ${ignore ? 'IGNORE' : ''} `
		return this
	}

	static INSERT(ignore = false) {
		const object = new this()
		return object.INSERT(ignore)
	}

	INTO(table = this.constructor.name) {
		this._query += ` INTO ${table}`
		return this
	}

	static DELETE() {
		const object = new this()
		return object.DELETE()
	}

	DELETE() {
		this._query = 'DELETE '
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

	EXPLAIN() {
		this._query = 'EXPLAIN ' + this._query
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

	EX(expireSecond, cacheKey) {
		this._EX = {
			key: cacheKey,
			EX: expireSecond
		}
		return this
	}

	async exec(outSideConnection = null) {
		this._connection = outSideConnection || await pool.createConnection()
		try {
			let results

			this._connection.useWriter = this._forceWriter
			this._forceWriter = false

			if (this._nestTables) {
				this._nestTables = false
				this._query = {
					sql: this._query,
					nestTables: true
				}
			}

			const ex = this._EX
			this._EX = {}

			if (this._print) {
				this._print = false
				results = await this._connection.print.q(this._query, this._queryValues, ex)
			} else {
				results = await this._connection.q(this._query, this._queryValues, ex)
			}

			if (this._connection.isSelect(this._query.sql || this._query)) {

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

function addQuery(reservedWord, whereCaluse, whereCaluse2 = 'oooooooo', inBrackets = true) {
	if (!whereCaluse) {
		return this
	}

	if (typeof whereCaluse == 'string') {

		if (inBrackets) {
			this._query += ` ${reservedWord} (${whereCaluse}) `
		} else {
			this._query += ` ${reservedWord} ${whereCaluse} `
		}

		if (whereCaluse2 != 'oooooooo' && whereCaluse2 instanceof Array) {
			this._queryValues = this._queryValues.concat(whereCaluse2)
		} else if (whereCaluse2 != 'oooooooo') {
			this._queryValues.push(whereCaluse2)
		}
	} else {
		this._queryValues.push(whereCaluse)
		this._query += ` ${reservedWord} ? `
	}

	return this
}