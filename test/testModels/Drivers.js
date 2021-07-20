const Base = require('../../src/Pool').Schema

module.exports = class drivers extends Base {

	get columns() {
		return {
			'driver_id': Base.Types.PK,
			'location': Base.Types.Point,
			'heading': Base.Types.Number,
			'trip_eta': Base.Types.Number,
			'trip_id': {
				type: Base.Types.FK(require('./Trips'), 'trip_id'),
				required: true,
			},


			////visual
			'all_trips': [require('./Trips')],
			'trips': [Base.Types.FK(require('./Trips'), 'driver_id')],
		}
	}
}
