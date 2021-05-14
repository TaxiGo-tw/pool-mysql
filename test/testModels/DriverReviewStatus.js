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
				type: Scheme.Types.String,
				required: true,
				length: 5
			},
			'last_name': {
				type: Scheme.Types.String,
				required: true
			},
			'car_brand': {
				type: Scheme.Types.JSONString,
			},
			'model': {
				type: String
			},
			'phone_number': {
				type: Scheme.Types.String,
				required: true,
				length: 10
			},
			'plate_number': {
				type: PlateNumber,
				required: true,
				length: { min: 5, max: 8 }
			},
			'enum': ['a', 'b']
		}
	}
}
