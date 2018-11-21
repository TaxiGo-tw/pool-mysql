const Base = require('../../index').Schema

module.exports = class drivers extends Base {

	get columns() {
		return {
			'driver_id': Base.Types.PK,
			'location': Base.Types.Point,
			'heading': Number,
			'trip_eta': Number
		}
	}
}