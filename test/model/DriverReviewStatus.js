const Scheme = require('../../index').Schema

class PlateNumber extends Scheme.Types.Base {
	static validate(string) {
		return string.match(/[0-9]+-[A-Z]+/)
	}
}

module.exports = class driver_review_status extends Scheme {

	get columns() {
		return {
			'uid': {
				type: Scheme.Types.PK,
				required: true
			},
			'first_name': {
				type: Scheme.Types.Str,
				required: true
			},
			'last_name': String,
			'car_brand': {
				type: Scheme.Types.JSONString,
			},
			'model': {
				type: String
			},
			'plate_number': {
				type: PlateNumber
			}
		}
	}
}
