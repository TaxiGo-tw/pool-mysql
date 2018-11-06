require('dotenv').config({ path: '.env' })

const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`

const Trips = require('./model/Trips')
const Users = require('./model/Users')

describe('test query', async () => {
	it('3', async () => {
		const query = Trips.
			SELECT()
			.FROM()
			.WHERE('trip_id = ?', 23890)
			.LIMIT()

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].should.not.have.property('user')
		query.FORMATTED().formatted.should.equals('SELECT trips.trip_id, trips.user_id FROM trips WHERE (trip_id = 23890) LIMIT 20')
	})
})

describe('test POPULATE', async () => {
	it('4', async () => {
		const query = Trips.
			SELECT()
			.FROM()
			.WHERE('trip_id = ?', 23890)
			.LIMIT()
			.POPULATE('user')

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].should.have.property('user')
		query.FORMATTED().formatted.should.equals('SELECT trips.trip_id, trips.user_id FROM trips WHERE (trip_id = 23890) LIMIT 20')
	})
})

describe('test LEFT JOIN, NESTTABLES', async () => {

	it('1', async () => {
		const query = Trips.
			SELECT(Trips.KEYS, Users.KEYS)
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE('trip_id = ?', 23890)
			.AND('trip_id > 0')
			.LIMIT()
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
		query.FORMATTED().formatted.should.equals('SELECT trips.trip_id, trips.user_id, user_info.uid FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE (trip_id = 23890) AND (trip_id > 0) LIMIT 20')
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
			.LIMIT()

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].should.have.property('user')
		query.FORMATTED().formatted.should.equals('SELECT trips.trip_id, trips.user_id, user_info.* FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE `trip_id` = 23890 AND (trip_id > 0) LIMIT 20')
	})

	it('5', async () => {
		const query = Trips.
			SELECT('trips.*, user_info.*')
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE('trip_id = ?', 23890)
			.LIMIT()

		const results = await query.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('start_address')
		query.FORMATTED().formatted.should.equals('SELECT trips.*, user_info.* FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE (trip_id = 23890) LIMIT 20')
	})

	it('6', async () => {
		const query = Trips.
			SELECT('start_address, first_name')
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE('trip_id = ?', 23890)
			.LIMIT()

		const results = await query.exec()

		results[0].should.have.property('start_address')
		results[0].should.have.property('first_name')
		query.FORMATTED().formatted.should.equals('SELECT start_address, first_name FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE (trip_id = 23890) LIMIT 20')
	})

	it('7', async () => {
		const query = Trips.
			SELECT(`trip_hash, first_name`)
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE('trip_id = ?', 23890)
			.OR('trip_hash = ?', 'LPawCZ')
			.LIMIT()

		const results = await query.exec()

		results[0].should.have.property('trip_hash')
		results[0].should.have.property('first_name')
		query.FORMATTED().formatted.should.equals(`SELECT trip_hash, first_name FROM trips LEFT JOIN user_info ON uid = trips.user_id WHERE (trip_id = 23890) OR (trip_hash = 'LPawCZ') LIMIT 20`)
	})
})

describe('test GROUP BY', async () => {
	it('1', async () => {
		const query = Trips.
			SELECT('driver_id, count(*) count')
			.FROM()
			.WHERE('trip_status = "TRIP_PAYMENT_PROCESSED"')
			.AND('driver_id IS NOT NULL')
			.AND('user_id IS NOT NULL')
			.GROUP_BY('driver_id', 'user_id')
			.LIMIT(20)

		const results = await query.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('count')
		query.FORMATTED().formatted.should.equals(`SELECT driver_id, count(*) count FROM trips WHERE (trip_status = "TRIP_PAYMENT_PROCESSED") AND (driver_id IS NOT NULL) AND (user_id IS NOT NULL) GROUP BY driver_id, user_id LIMIT 20`)
	})

	it('2', async () => {
		const query = Trips.
			SELECT('driver_id, count(*) count')
			.FROM()
			.WHERE('trip_status = "TRIP_PAYMENT_PROCESSED"')
			.AND('driver_id IS NOT NULL')
			.AND('user_id IS NOT NULL')
			.GROUP_BY('driver_id, user_id')
			.LIMIT(20)

		const results = await query.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('count')
		query.FORMATTED().formatted.should.equals(`SELECT driver_id, count(*) count FROM trips WHERE (trip_status = "TRIP_PAYMENT_PROCESSED") AND (driver_id IS NOT NULL) AND (user_id IS NOT NULL) GROUP BY driver_id, user_id LIMIT 20`)
	})

	it('3', async () => {
		const query = Trips.
			SELECT('driver_id, count(*) count')
			.FROM('trips')
			.WHERE('trip_status = "TRIP_PAYMENT_PROCESSED"')
			.AND('driver_id IS NOT NULL')
			.AND('user_id IS NOT NULL')
			.GROUP_BY('driver_id, user_id')
			.LIMIT(20)

		const results = await query.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('count')
		query.FORMATTED().formatted.should.equals(`SELECT driver_id, count(*) count FROM trips WHERE (trip_status = "TRIP_PAYMENT_PROCESSED") AND (driver_id IS NOT NULL) AND (user_id IS NOT NULL) GROUP BY driver_id, user_id LIMIT 20`)
	})
})


describe('test HAVING', async () => {
	it('1', async () => {
		const query = Trips.
			SELECT('driver_id, count(*) count')
			.FROM()
			.WHERE('trip_status = "TRIP_PAYMENT_PROCESSED"')
			.AND('driver_id IS NOT NULL')
			.GROUP_BY('driver_id')
			.HAVING('count > 100', 'driver_id < 10000')
			.LIMIT()

		const results = await query.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('count')
		query.FORMATTED().formatted.should.equals(`SELECT driver_id, count(*) count FROM trips WHERE (trip_status = "TRIP_PAYMENT_PROCESSED") AND (driver_id IS NOT NULL) GROUP BY driver_id HAVING (count > 100 AND driver_id < 10000) LIMIT 20`)
	})
})

describe('test long query', async () => {
	it('2', async () => {
		const query = await Trips.SELECT(`first_name, SUBSTRING(a.phone_number, 2) phone_number`)
			.FROM('user_info a, trips b')
			.WHERE('trip_hash = ?', 'LPawCZ')
			.AND(`user_id = ? OR driver_id = ?`, [101, 101])
			.AND('a.uid = IF(b.user_id = ?, b.driver_id, b.user_id) or a.uid = IF(b.driver_id = ?, b.user_id, b.driver_id)', [101, 101])
			.AND(`b.trip_status NOT IN (?)`, ['driver_reserved'])

		await query.exec()

		query.FORMATTED().formatted.should.equals(`SELECT first_name, SUBSTRING(a.phone_number, 2) phone_number FROM user_info a, trips b WHERE (trip_hash = 'LPawCZ') AND (user_id = 101 OR driver_id = 101) AND (a.uid = IF(b.user_id = 101, b.driver_id, b.user_id) or a.uid = IF(b.driver_id = 101, b.user_id, b.driver_id)) AND (b.trip_status NOT IN ('driver_reserved'))`)
	})

	it('3', async () => {
		const query = Trips
			.SELECT('trips.user_id, bot_id, trip_id, request_time, reserve_time, trip_status, start_latlng, end_latlng, last_latlng, start_address, end_address, feature_map, payment_method, IFNULL(test_users.user_id, 0) as test')
			.FROM()
			.LEFTJOIN('test_users ON trips.user_id = test_users.user_id')
			.WHERE('trip_status IN ("WAITING_SPECIFY", "REQUESTING_DRIVER", "PENDING_RESPONSE_DRIVER")')
			.AND('request_time = reserve_time')
			.AND('trips.user_id NOT IN (SELECT user_id FROM blocked_users WHERE (end_time = -1 OR UNIX_TIMESTAMP() BETWEEN start_time AND end_time))')

		await query.exec()

		query.FORMATTED().formatted.should.equals(`SELECT trips.user_id, bot_id, trip_id, request_time, reserve_time, trip_status, start_latlng, end_latlng, last_latlng, start_address, end_address, feature_map, payment_method, IFNULL(test_users.user_id, 0) as test FROM trips LEFT JOIN test_users ON trips.user_id = test_users.user_id WHERE (trip_status IN ("WAITING_SPECIFY", "REQUESTING_DRIVER", "PENDING_RESPONSE_DRIVER")) AND (request_time = reserve_time) AND (trips.user_id NOT IN (SELECT user_id FROM blocked_users WHERE (end_time = -1 OR UNIX_TIMESTAMP() BETWEEN start_time AND end_time)))`)
	})
})
