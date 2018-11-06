require('dotenv').config({ path: '.env' })

const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`

const Trips = require('./model/Trips')
const Users = require('./model/Users')

describe('test query', async () => {
	it('1', async () => {
		const query = Trips.
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

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].trip_id.should.equal(23890)
		results[0].should.have.property('user_id')
		results[0].should.have.property('user')
		results[0].user.should.have.property('uid')
		query.FORMATTED().formatted.should.equals('SELECT trips.trip_id, trips.user_id, user_info.uid FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE (trip_id = 23890) AND (trip_id > 0)')
	})

	it('2', async () => {
		const query = Trips.SELECT()
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

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].should.have.property('user')
		query.FORMATTED().formatted.should.equals('SELECT trips.trip_id, trips.user_id, user_info.* FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE `trip_id` = 23890 AND (trip_id > 0)')
	})


	it('3', async () => {
		const query = Trips.
			SELECT()
			.FROM()
			.WHERE('trip_id = ?', 23890)

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].should.not.have.property('user')
		query.FORMATTED().formatted.should.equals('SELECT trips.trip_id, trips.user_id FROM trips WHERE (trip_id = 23890)')
	})

	it('4', async () => {
		const query = await Trips.
			SELECT()
			.FROM()
			.WHERE('trip_id = ?', 23890)
			.POPULATE('user')

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].should.have.property('user')
		query.FORMATTED().formatted.should.equals('SELECT trips.trip_id, trips.user_id FROM trips WHERE (trip_id = 23890)')
	})

	it('5', async () => {
		const query = await Trips.
			SELECT('trips.*, user_info.*')
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE('trip_id = ?', 23890)

		const results = await query.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('start_address')
		query.FORMATTED().formatted.should.equals('SELECT trips.*,  user_info.* FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE (trip_id = 23890)')
	})

	it('5', async () => {
		const query = await Trips.
			SELECT('*')
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE('trip_id = ?', 23890)

		const results = await query.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('first_name')
		query.FORMATTED().formatted.should.equals('SELECT * FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE (trip_id = 23890)')
	})
})