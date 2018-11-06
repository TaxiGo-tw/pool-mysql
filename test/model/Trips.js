const Schema = require('../../index').Schema

module.exports = class trips extends Schema {
	get columns() {
		return {
			trip_id: Schema.Types.PK,
			user_id: Number,
			user: {
				ref: require('./Users'),
				column: 'user_id'
			}
		}
	}

	toPublic() {
		return {
			trip_hash: this.trip_hash
		}
	}
}