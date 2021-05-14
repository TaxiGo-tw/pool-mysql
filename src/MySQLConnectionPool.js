const assert = require('assert')

module.exports = class ConnectionPool {
	constructor() {
		this.connectionRequests = []
		this.waiting = []
		this.using = {
			default: {}
		}
	}

	shift() {
		return this.waiting.shift()
	}

	setUsing(mysqlConnection) {
		if (!this.using[mysqlConnection.tag]) {
			this.using[mysqlConnection.tag] = {}
		}

		if (!this.using[mysqlConnection.tag][mysqlConnection.connectionID]) {
			this.using[mysqlConnection.tag][mysqlConnection.connectionID] = mysqlConnection
		} else {
			assert.fail(`get ${mysqlConnection.role} duplicated connection`)
		}
	}
}
