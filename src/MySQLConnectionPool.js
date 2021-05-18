const assert = require('assert')

module.exports = class MySQLConnectionPool {
	constructor(options) {
		this._options = options

		this.connectionRequests = []
		this.waiting = []
		this.using = {
			default: {
				12: {}
			}
		}
	}

	count() {
		const waiting = this.waiting.length
		const using = Object.values(this.using)
			.map(o => Object.keys(o).length)
			.reduce((a, b) => { a + b }, 0)

		const total = waiting + using

		return total
	}

	shift() {
		return this.waiting.shift()
	}

	setUsing(mysqlConnection) {
		console.log(mysqlConnection.tag)
		if (!this.using[mysqlConnection.tag.name]) {
			this.using[mysqlConnection.tag.name] = {}
		}

		if (!this.using[mysqlConnection.tag.name][mysqlConnection.connectionID]) {
			this.using[mysqlConnection.tag.name][mysqlConnection.connectionID] = mysqlConnection
		} else {
			assert.fail(`get ${mysqlConnection.role} duplicated connection`)
		}
	}
}
