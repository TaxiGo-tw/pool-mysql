const Schema = require('../../index').Schema
module.exports = class user_info extends Schema {
	get columns() {
		return {
			uid: {
				type: Schema.Types.PK
			}
		}
	}

	toPublic() {
		return {
			trip_hash: this.trip_hash
		}
	}
}
