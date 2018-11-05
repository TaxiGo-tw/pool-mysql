const Base = require('../../index').Schema

module.exports = class trips extends Base {
	get columns() {
		return {
			trip_id: Base.Types.PK,
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