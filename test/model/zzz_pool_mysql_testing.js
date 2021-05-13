const pool = require('../../index')
const Schema = pool.Schema

module.exports = class zzz_pool_mysql_testing extends Schema {
	get columns() {
		return {
			id: Schema.Types.Number,
			email: Schema.Types.Email,
		}
	}
}
