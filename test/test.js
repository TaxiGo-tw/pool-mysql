require('dotenv').config({ path: '.env' })

const { assert, expect, should, use } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`

const Trips = require('./model/Trips')
const Users = require('./model/Users')

describe('test query', async () => {
	let title = 'SELECT trips.trip_id, trips.user_id, user_info.uid FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE (trip_id = 23890) AND (trip_id > 0)'

	it(title, async () => {
		const results = await Trips.
			SELECT(Trips.KEYS, Users.KEYS)
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE('trip_id = ?', 23890)
			.AND('trip_id > 0')
			.NESTTABLES()
			.MAP(result => {
				const trip = result.trips
				trip.user = result.user_info
				return trip
			})
			.exec()

		results[0].should.have.property('trip_id')
		results[0].trip_id.should.equal(23890)

		results[0].should.have.property('user_id')
		results[0].should.have.property('user')
		results[0].user.should.have.property('uid')
	})

	title = 'SELECT trips.trip_id, trips.user_id, user_info.* FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE `trip_id` = 23890 AND (trip_id > 0)'
	it(title, async () => {
		const results = await Trips.SELECT()
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE({ trip_id: 23890 })
			.AND('trip_id > 0')
			.NESTTABLES()
			.MAP(result => {
				const trip = result.trips
				trip.user = result.user_info
				return trip
			})
			.exec()

		// console.log(Trips.SELECT()
		// 	.FROM()
		// 	.LEFTJOIN('user_info ON uid = trips.user_id')
		// 	.WHERE({ trip_id: 23890 })
		// 	.AND('trip_id > 0')
		// 	.FORMATTED())

		results[0].should.have.property('trip_id')
		results[0].should.have.property('user')
	})

	title = 'SELECT trips.trip_id, trips.user_id FROM trips WHERE (trip_id = 23890)'
	it(title, async () => {
		const results = await Trips.
			SELECT()
			.FROM()
			.WHERE('trip_id = ?', 23890)
			.exec()

		results[0].should.have.property('trip_id')
		results[0].should.not.have.property('user')
	})


	title = `SELECT trips.trip_id, trips.user_id FROM trips WHERE (trip_id = 23890)
						SELECT user_info.uid FROM user_info WHERE (uid IN (101))`
	it(title, async () => {
		const results = await Trips.
			SELECT()
			.FROM()
			.WHERE('trip_id = ?', 23890)
			.POPULATE('user')
			.exec()

		results[0].should.have.property('trip_id')
		results[0].should.have.property('user')
	})

	title = 'SELECT trips.*,  user_info.* FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE (trip_id = 23890)'
	it(title, async () => {
		const results = await Trips.
			SELECT('trips.*, user_info.*')
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE('trip_id = ?', 23890)
			.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('start_address')
	})

	before(async () => { })
	beforeEach(async () => { })
	afterEach(async () => { })
})