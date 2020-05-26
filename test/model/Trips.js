const Schema = require('../../index').Schema

module.exports = class trips extends Schema {

	constructor(trip) {
		super(trip)

		const DriverReviewStatus = require('./DriverReviewStatus')
		const Drivers = require('./Drivers')
		this.driver_info = trip && trip.driver_info ? new DriverReviewStatus(trip.driver_info) : undefined
		this.driver_info = trip && trip.driver_loc ? new Drivers(trip.driver_info) : undefined
	}

	get columns() {
		return {
			// trip_id: Schema.Types.PK,
			trip_id: {
				type: Schema.Types.PK,
				// required: true
			},
			user_id: Schema.Types.Num,
			user: {
				ref: require('./Users'),
				column: 'user_id'
			},
			driver_id: Number,
			driver_loc: {
				ref: require('./Drivers'),
				column: 'driver_id'
			},
			driver_info: {
				ref: require('./DriverReviewStatus'),
				column: 'driver_id'
			},
		}
	}
}
