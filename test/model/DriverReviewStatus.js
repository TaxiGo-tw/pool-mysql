const Base = require('../../index').Schema

module.exports = class driver_review_status extends Base {

	get columns() {
		return {
			'uid': Base.Types.PK,
			'first_name': String,
			'last_name': String,
			'car_brand': String,
			'model': String,
			'plate_number': String
		}
	}
}