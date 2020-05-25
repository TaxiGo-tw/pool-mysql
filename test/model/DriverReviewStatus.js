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

	//triggered at every insert, update
	validations({ uid, first_name, last_name, car_brand, model, plate_number }) {
		switch (true) {
			case Base.Validations.isNUMBER(uid):
				return false
			case Base.Validations.isJSONString(first_name):
				throw ''
		}
	}
}
