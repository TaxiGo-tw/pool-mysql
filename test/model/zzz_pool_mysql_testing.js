const pool = require('../../index')
const Schema = pool.Schema

module.exports = class zzz_pool_mysql_testing extends Schema {
	get columns() {
		return {
			id: {
				type: Schema.Types.Number
			},
			email: {
				type: Schema.Types.Email
			},


			fk: {
				ref: Schema.Types.FK(require('./Trips'), 'id')
			}
		}
	}
}
