const Base = require('../../index').Schema
module.exports = class user_info extends Base {
	get columns() {
		return {
			uid: Base.Types.PK,
		}
	}

	toPublic() {
		return {
			trip_hash: this.trip_hash
		}
	}
}