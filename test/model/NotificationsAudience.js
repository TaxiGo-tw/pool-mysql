const Scheme = require('../../index').Schema
module.exports = class notifications_audience extends Scheme {

	get columns() {
		return {
			'id': {
				type: Scheme.Types.PK,
			},
			'audience': {
				type: Scheme.Types.String,
				required: true
			},
			'sql_query': {
				type: Scheme.Types.SQLSelectOnlyString,
				required: true
			}
		}
	}
}
