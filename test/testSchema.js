const { should, expect, assert } = require('chai')  // Using Assert style
should()

const Trips = require('./testModels/Trips')
const Users = require('./testModels/Users')
const Block = require('./testModels/BlockPersonally')
const Drivers = require('./testModels/Drivers')

const pool = require('../src/Pool')
const Redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(Redis.RedisClient.prototype)
bluebird.promisifyAll(Redis.Multi.prototype)
pool.redisClient = Redis.createClient({
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT
	// db: process.env.NODE_ENV == 'production' ? 14 : 15
})

describe('test query', async () => {
	it('with cache', async () => {
		const id = 23890
		let ii
		const query = Trips
			.SELECT()
			.FROM()
			.WHERE({ trip_id: id })
			.AND({ trip_id: id })
			.AND('trip_id = ?', ii)
			.ORDER_BY('trip_id')
			.LIMIT()
			.EX(2)

		const results = await query.exec()

		results.length.should.equal(0)
	})

	it('with cache', async () => {
		const query = Trips
			.SELECT()
			.FROM()
			.WHERE({ trip_id: 23890 })
			.AND({ trip_id: 23890 })
			.LIMIT()
			.EX(2)

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].should.not.have.property('user')
	})


	it('with cache force update', async () => {
		const query = Trips.
			SELECT()
			.FROM()
			.WHERE({ trip_id: 23890 })
			.AND({ trip_id: 23890 })
			.LIMIT()
			.EX(2, { forceUpdate: true })

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].should.not.have.property('user')
	})

	it('without cache', async () => {
		const id = 23890
		const query = Trips
			.SELECT()
			.FROM()
			.WHERE('trip_id = ?', id)
			.AND('trip_id <> ?', id, { isExec: false })
			.ORDER_BY('trip_id')
			.LIMIT()
			.EX(2)

		let results = await query.exec()
		results = await query.exec()

		results.length.should.equal(1)
	})

	it('object entity', async () => {
		const trip = new Trips()

		const query = trip
			.SELECT()
			.FROM()
			.WHERE({ trip_id: 23890 })
			.AND({ trip_id: 23890 })
			.FIRST()
			.FILTER(t => t.trip_id != 23890)

		const result = await query.exec()

		should(result).equal(undefined)
	})

	it('object entity', async () => {
		const trip = new Trips()

		const obj = { trip_id: 23890, user_id: 21640 }
		const query = trip
			.SELECT()
			.FROM()
			.WHERE_AND(obj)
			.FIRST()
		// .FILTER(t => t.trip_id != 23890)

		const result = await query.exec()

		assert.equal(result.trip_id, obj.trip_id)
		assert.equal(result.user_id, obj.user_id)
	})

	it('find', async () => {
		const query = Trips.FIND({ trip_id: 23890 }).FIRST()
		const result = await query.exec()

		result.should.have.property('trip_id')
		result.should.not.have.property('user')
	})

	it('where string', async () => {
		const query = Trips.SELECT().FROM().WHERE(' trip_id = ?', 23890).FIRST()
		const result = await query.exec()

		result.should.have.property('trip_id')
		result.should.not.have.property('user')
	})

	it('find string', async () => {
		const query = Trips.FIND(' trip_id = ?', 23890).FIRST()
		const result = await query.exec()

		result.should.have.property('trip_id')
		result.should.not.have.property('user')
	})


	it('find pk', async () => {
		const query = Trips.FIND_PK(23890)
		const result = await query.exec()

		result.should.have.property('trip_id')
		result.should.not.have.property('user')
	})

	it('filter', async () => {
		const trip = new Trips()

		const query = trip.
			SELECT()
			.FROM()
			.WHERE({ trip_id: 23890 })
			.AND({ trip_id: 23890 })
			.FIRST()
			.FILTER(t => t.trip_id == 23890)

		const result = await query.exec()

		result.should.have.property('trip_id')
		result.should.not.have.property('user')
	})
})

describe('test POPULATE', async () => {
	before(async () => {
		await Drivers.UPDATE().SET({ trip_id: 23890 }).WHERE({ driver_id: 3925 }).exec()
	})

	it('POPULATE first', async () => {
		const query = Trips.
			SELECT()
			.FROM()
			.WHERE('trip_id = ?', 23890)
			.POPULATE('user')
			.FIRST()

		const results = await query.exec()

		results.should.have.property('trip_id')
		results.should.have.property('user')
		results.user.should.have.property('uid')

	})

	it('POPULATE 1v1', async () => {
		const result = await Trips
			.SELECT()
			.FROM()
			.WHERE({ user_id: 3925 })
			.AND('driver_id')
			.ORDER_BY('trip_id', 'desc')
			.POPULATE('driver_loc', 'driver_info')
			.FIRST()
			.exec()

		result.should.have.property('trip_id')
		result.should.have.property('user_id')
		result.driver_loc.should.have.property('location')
		result.driver_info.should.have.property('first_name')
	})


	it('POPULATE 1vN', async () => {
		const result = await Drivers
			.SELECT()
			.FROM()
			.WHERE({ driver_id: 3925 })
			.ORDER_BY('trip_id', 'desc')
			.POPULATE('all_trips')
			.FIRST()
			.exec()

		result.should.have.property('all_trips')
		result.all_trips[0].should.have.property('user_id')
		result.all_trips[0].should.have.property('start_latlng')
	})

	it('POPULATE 1v1 FK', async () => {

		const result = await Drivers
			.SELECT()
			.FROM()
			.WHERE({ driver_id: 3925 })
			.ORDER_BY('trip_id', 'desc')
			.POPULATE('trip_id')
			.FIRST()
			.exec()

		result.should.have.property('trip_id')
		result.trip_id.should.have.property('trip_id')
	})

	it('POPULATE 1vN FK', async () => {
		const result = await Trips
			.SELECT()
			.FROM()
			.WHERE({ driver_id: 3925 })
			.POPULATE('driver_loc_FK_single')
			.FIRST()
			.exec()

		result.should.have.property('driver_loc_FK_single')
	})

	it('POPULATE nest object', async () => {
		const result = await Drivers
			.SELECT()
			.FROM()
			.WHERE({ driver_id: 3925 })
			.POPULATE({
				trip_id: {
					//TODO: driver_id:3925,
					driver_loc_FK_multiple: {
						//TODO: driver_id:3925,
						trip_id: {
							//TODO: driver_id:3925,
							driver_loc_FK_single: {
								//TODO: driver_id:3925,
							}
						}
					}
				}
			})
			.FIRST()
			.exec()

		result.should.have.property('trip_id')
		result.trip_id.should.have.property('driver_loc_FK_multiple')

		const [driver_loc_FK_multiple] = result.trip_id.driver_loc_FK_multiple
		driver_loc_FK_multiple.should.have.property('trip_id')
		driver_loc_FK_multiple.trip_id.should.have.property('driver_loc_FK_single')
		driver_loc_FK_multiple.trip_id.driver_loc_FK_single.should.have.property('driver_id')

	})

	it('POPULATE nest object', async () => {
		const result = await Drivers
			.SELECT()
			.FROM()
			.WHERE({ driver_id: 3925 })
			.POPULATE({
				trip_id: {
					//TODO: driver_id:3925,
					driver_loc_FK_multiple: {
						//TODO: driver_id:3925,
						trip_id: {
							//TODO: driver_id:3925,
							driver_loc_FK_multiple: {
								//TODO: driver_id:3925,
							}
						}
					},
					ttttt: {}
				}
			})
			.FIRST()
			.exec()

		result.should.have.property('trip_id')
		result.trip_id.should.have.property('driver_loc_FK_multiple')
		result.trip_id.ttttt.should.have.property('trip_id')

		expect(result.trip_id.driver_loc_FK_multiple).to.be.a('Array')
		result.trip_id.driver_loc_FK_multiple[0].should.have.property('trip_id')
		result.trip_id.driver_loc_FK_multiple[0].trip_id.should.have.property('driver_loc_FK_multiple')
	})

	after(async () => {
		await Drivers.UPDATE().SET({ trip_id: 0 }).WHERE({ driver_id: 3925 }).exec()
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
		assert(results[0] instanceof Trips)
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
		assert(results[0] instanceof Trips)
	})

	it('NESTED', async () => {
		const query = Trips.SELECT()
			.FROM()
			.LEFTJOIN('user_info ON uid = trips.user_id')
			.WHERE({ trip_id: 23890 })
			.AND('trip_id > 0')
			.NESTED()
			.LIMIT()

		const results = await query.exec()
		results[0].should.have.property('trip_id')
		results[0].should.have.property('user_info')
		results[0].user_info.should.have.property('uid')
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
		assert(results[0] instanceof Trips)
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
		assert(results[0] instanceof Trips)
	})
})

describe('test GROUP BY', () => {
	it('1', async () => {
		const results = await Trips
			.SELECT('driver_id, count(*) count')
			.FROM()
			.WHERE('trip_status = "TRIP_PAYMENT_PROCESSED"')
			.AND('trip_id < 100000')
			.AND('driver_id IS NOT NULL')
			.AND('user_id IS NOT NULL')
			.GROUP_BY('driver_id', 'user_id')
			.LIMIT(1)
			.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('count')
		assert(results[0] instanceof Trips)
	})

	it('2', async () => {
		const results = await Trips.
			SELECT('driver_id, count(*) count')
			.FROM()
			.WHERE('trip_status = "TRIP_PAYMENT_PROCESSED"')
			.AND('trip_id < 20000')
			.AND('driver_id IS NOT NULL')
			.AND('user_id IS NOT NULL')
			.GROUP_BY('driver_id, user_id')
			.LIMIT(1)
			.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('count')
		assert(results[0] instanceof Trips)
	})

	it('3', async () => {
		const results = await Trips.
			SELECT('driver_id, count(*) count')
			.FROM()
			.WHERE('trip_status = "TRIP_PAYMENT_PROCESSED"')
			.AND('trip_id < 100000')
			.AND('driver_id IS NOT NULL')
			.AND('user_id IS NOT NULL')
			.GROUP_BY('driver_id, user_id')
			.LIMIT(1)
			.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('count')
		assert(results[0] instanceof Trips)
	})
})


describe('test HAVING', () => {
	it('1', async () => {
		const results = await Trips.
			SELECT('driver_id, count(*) count')
			.FROM()
			.WHERE('trip_status = "TRIP_PAYMENT_PROCESSED"')
			.AND('trip_id < 100000')
			.AND('driver_id IS NOT NULL')
			.GROUP_BY('driver_id')
			.HAVING('count > 100', 'driver_id < 10000')
			.LIMIT()
			.exec()

		results[0].should.have.property('driver_id')
		results[0].should.have.property('count')
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

	})
})

describe('test insert', async () => {
	it('3', async () => {
		const query = Block
			.INSERT(true)
			.INTO()
			.SET({ blocker: 201, blocked: 203, notes: 'test' })
			.DUPLICATE({ notes: 'ggg' })

		await query.exec()
	})

	it('4', async () => {
		const query = Block
			.INSERT(true)
			.INTO()
			.SET(`blocker = 201, blocked = 203, notes = 'test'`)
			.DUPLICATE(` notes = 'ggg' `)

		await query.exec()

	})
})

describe('test UPDATED', async () => {
	it('1', async () => {
		const query = Block
			.UPDATE()
			.SET('id = id')
			.WHERE({ blocked: 22762 })
			.AND({ blocked: 3925 })
			.UPDATED('id', 'blocker')
		const results = await query.exec()

		for (const result of results) {
			result.should.have.property('id')
			result.should.have.property('blocker')
		}
	})

	it('2', async () => {
		const [a, b, c] = await Trips.SELECT('trip_id').FROM().WHERE().LIMIT(3).MAP(t => t.trip_id).exec()

		await Trips
			.UPDATE()
			.SET(`driver_id = 3925, trip_status = 'TRIP_STARTED'`)
			.WHERE({ trip_id: a })
			.UPDATED('trip_id', 'user_id', 'driver_id', 'trip_status')
			.FIRST()
			.rollback()

		const results = await Trips
			.UPDATE()
			.SET(`trip_status = 'REQUESTING_DRIVER', start_address = '台北車站'`)
			.WHERE('trip_id IN (?, ?, ?)', [a, b, c])
			// .AND(`trip_status = 'TRIP_STARTED'`)
			// .UPDATED('trip_id')
			.UPDATED('trip_id', 'user_id', 'driver_id', 'trip_status', 'start_address')
			// .AFFECTED_ROWS(1)
			// .CHANGED_ROWS(1)
			// .FIRST()
			.AFFECTED_ROWS(3)
			// .CHANGED_ROWS(1)
			.rollback()

		assert.equal(results.length, 3)

		for (const result of results) {
			result.should.have.property('trip_id')
			result.should.have.property('user_id')
			result.should.have.property('driver_id')
			result.should.have.property('trip_status')
			result.should.have.property('start_address')
			// result.should.have.property('start_latlng')
		}
	})

	it('3 test point', async () => {
		const trip_id = 29106

		const result = await Trips
			.UPDATE()
			.SET({
				driver_id: 3925,
				trip_status: 'DRIVER_RESERVED',
				//update POINT
				start_latlng: {
					x: 25.5,
					y: 121.5
				},
				//update POINT
				end_latlng: '25.5, 123.5'
			})
			.WHERE({ trip_id })
			.FIRST()
			.exec()

		assert.equal(result.affectedRows, 1)
	})

	it('4 test point fail', async () => {
		const trip_id = 29106

		const result = await Trips
			.UPDATE()
			.SET({
				driver_id: 3925,
				trip_status: 'DRIVER_RESERVED',
				//update POINT
				start_latlng: {
					x: 25.5,
					y: 121.5
				},
				//update POINT
				end_latlng: '25.555555, 123.555555'
			})
			.WHERE({ trip_id })
			.FIRST()

		assert.equal(result.FORMATTED().formatted, 'UPDATE trips SET `driver_id` = 3925, `trip_status` = \'DRIVER_RESERVED\', `start_latlng` = POINT(25.5, 121.5), `end_latlng` = POINT(25.555555, 123.555555) WHERE (`trip_id` = 29106) LIMIT 1')
	})

	it('5 test point fail', async () => {
		const trip_id = 29106
		try {

			await Trips
				.UPDATE()
				.SET({
					driver_id: 3925,
					trip_status: 'DRIVER_RESERVED',
					//update POINT
					start_latlng: {
						x: 'hi',
						y: 121.5
					},
					//update POINT
					end_latlng: '25.5555, aaa'
				})
				.WHERE({ trip_id })
				.FIRST()
				.exec()

		} catch (error) {
			assert.equal(error.message, `trips.start_latlng must be type: 'Point', not 'object' {"driver_id":3925,"trip_status":"DRIVER_RESERVED","start_latlng":{"x":"hi","y":121.5},"end_latlng":"25.5555, aaa"}`)
		}
	})
})


describe('test LIMIT OFFSET', () => {
	it('1 ori', async () => {
		const checkTrips = Trips.SELECT().FROM().LIMIT()

		expect(checkTrips._q[2].type).to.equal('LIMIT')
		expect(checkTrips._q[2].value).to.equal(20)
	})

	it('2-1 limit', async () => {
		const results = await Trips.SELECT().FROM().LIMIT(2)

		//預期 2 筆行程
		expect(results._q[2].type).to.equal('LIMIT')
		expect(results._q[2].value).to.equal(2)
	})

	it('2-2 limit', async () => {
		const results = await Trips.SELECT().FROM().LIMIT(3)

		//預期 3 筆行程
		expect(results._q[2].type).to.equal('LIMIT')
		expect(results._q[2].value).to.equal(3)
	})

	it('3-1 offset', async () => {
		const results = await Trips.SELECT().FROM().LIMIT(2).OFFSET(0)

		//預期 2 筆行程
		expect(results._q[2].type).to.equal('LIMIT')
		expect(results._q[2].value).to.equal(2)
	})

	it('3-2 offset', async () => {
		const results = await Trips.SELECT().FROM().LIMIT(2).OFFSET(2)

		expect(results._q[2].type).to.equal('LIMIT')
		expect(results._q[2].value).to.equal(2)
		expect(results._q[3].type).to.equal('OFFSET')
		expect(results._q[3].value).to.equal(2)
	})

	it('4-1 default', async () => {
		const results = await Trips.SELECT().FROM().LIMIT(null, 2).OFFSET(null, 2)

		expect(results._q[2].type).to.equal('LIMIT')
		expect(results._q[2].value).to.equal(2)
		expect(results._q[3].type).to.equal('OFFSET')
		expect(results._q[3].value).to.equal(2)
	})

	it('5-1 LIMIT isExec', async () => {
		const results = await Trips.SELECT().FROM().LIMIT(2, 2, { isExec: true })

		expect(results._q[2].type).to.equal('LIMIT')
		expect(results._q[2].value).to.equal(2)
	})

	it('5-2 LIMIT isExec', async () => {
		const results = await Trips.SELECT().FROM().LIMIT(2, 2, { isExec: false })

		expect(results._q.length).to.equal(2)
	})

	it('6-1 OFFSET isExec', async () => {
		const results = await Trips.SELECT()
			.FROM()
			.LIMIT(2)
			.OFFSET(2, 2, { isExec: false })
		expect(results._q.length).to.equal(3)
	})

	it('6-2 OFFSET isExec', async () => {
		const results = await Trips.SELECT()
			.FROM()
			.LIMIT(2)
			.OFFSET(2, 2, { isExec: true })

		expect(results._q[2].type).to.equal('LIMIT')
		expect(results._q[2].value).to.equal(2)
		expect(results._q[3].type).to.equal('OFFSET')
		expect(results._q[3].value).to.equal(2)
	})
})


describe('test insert values', async () => {
	it('5', async () => {
		const query = Block
			.INSERT()
			.INTO(`block_personally (blocker, blocked, notes)`)
			.VALUES([[101, undefined, '101 block 301'], [101, 402, '101 block 402']])

		assert.equal(query.FORMATTED().formatted, `INSERT  INTO block_personally (blocker, blocked, notes) VALUES (101,NULL,'101 block 301'),(101,402,'101 block 402')`)
	})
})

describe('test update table', () => {
	it('1', async () => {

		const trips = await Trips.SELECT().FROM().LIMIT(5).EX(5).exec()

		for (const { trip_id } of trips) {
			await Trips.UPDATE().SET('start_address = start_address').WHERE({ trip_id }).rollback()
		}
	})

	it('1', async () => {
		const connection = pool.connection()

		await connection.beginTransaction()
		const trips = await Trips.SELECT().FROM().LIMIT(5).EX(5).exec(connection)


		for (const { trip_id } of trips) {
			await Trips.UPDATE().SET('start_address = start_address').WHERE({ trip_id }).exec(connection)
		}

		await connection.rollback()
		connection.release()
	})
})

describe('test update multi table', () => {
	it('1', () => {

		const query = Trips.UPDATE('trips, user_info')
			.SET({ user_id: 3925, request_time: '2020-01-01 08:32:50 GMT+08:00' })
			.WHERE({ uid: 3925 })
			.AND('trips.user_id = user_info.uid')

		assert.equal(
			query.FORMATTED().formatted,
			'UPDATE trips, user_info SET `user_id` = 3925, `request_time` = 1577838770 WHERE (`uid` = 3925) AND (trips.user_id = user_info.uid)', 'fail format'
		)
	})
})

describe('test onErr', () => {
	const errMessage = 'test message on error'

	it('string', async () => {
		try {

			await Trips.UPDATE('user_info')
				.SET({ uid: 31 })
				.WHERE({ uid: 31 })
				.CHANGED_ROWS(1)
				.ON_ERR(errMessage)
				.exec()

			assert(false)
		} catch (err) {
			assert.equal(err.message, errMessage)
		}
	})

	it('callback', async () => {
		try {
			await Trips.UPDATE('user_info')
				.SET({ uid: 31 })
				.WHERE({ uid: 31 })
				.CHANGED_ROWS(1)
				.ON_ERR(_ => {
					return errMessage
				})
				.exec()

			assert(false)
		} catch (err) {
			assert.equal(err.message, errMessage)
		}
	})

	it('connection', async () => {
		try {
			const connection = await pool.createConnection()
			await connection.onErr(errMessage).q('...')

			assert(false)
		} catch (err) {
			assert.equal(err.message, errMessage)
		}
	})
})

describe('test map', () => {
	it('string', async () => {
		const result = await Trips
			.SELECT('UPPER(city) AS city')
			.FROM('fix_fare_open_city')
			.MAP(row => row.city)
			.FIRST()
			.exec()

		assert.equal(typeof result, 'string')
	})

	it('object', async () => {
		const result = await Trips
			.SELECT('UPPER(city) AS city')
			.FROM('fix_fare_open_city')
			.MAP(row => row)
			.FIRST()
			.exec()

		assert.equal(typeof result, 'object')
		assert(result instanceof Trips)
	})
})

describe('test reduce', () => {
	const reducer = (accumulator, currentValue) => {

		if (typeof accumulator == 'object') {
			accumulator = accumulator.amount
		} else if (typeof accumulator == 'undefined') {
			accumulator = 0
		}

		return parseInt(accumulator) + parseInt(currentValue.amount)
	}

	it('number', async () => {
		const result = await Trips
			.SELECT(`amount`)
			.FROM()
			.WHERE({ driver_id: 279555 })
			.AND(`amount > 0`)
			.REDUCE(reducer)
			.LIMIT(10)
			.exec()

		assert.equal(typeof result, 'number')
	})

	it('with initialValue', async () => {
		const result = await Trips
			.SELECT(`amount`)
			.FROM()
			.WHERE({ driver_id: 279555 })
			.AND(`amount > 0`)
			.REDUCE(reducer, 100)
			.LIMIT(10)
			.exec()

		assert.equal(typeof result, 'number')
	})
})

describe('test rollback', async () => {
	it('1', async () => {
		const notes = Math.random()
		const { insertId } = await Block
			.INSERT()
			.INTO()
			.SET({ blocker: 1353221, blocked: 203, notes })
			.DUPLICATE({ notes })
			.rollback()

		const expected = await Block
			.SELECT()
			.FROM()
			.WHERE({ id: insertId })
			.FIRST()
			.exec()

		assert.equal(expected, null)
	})
})

after(function () {
	console.log('after all tests')
	// process.exit()
})

// pool.event.on('get', connection => {
// 	console.log(connection.id)
// })

// pool.event.on('release', connection => {
// 	console.log(connection.id)
// })

// pool.event.on('query', string => {
// 	console.log(string)
// })
// pool.event.on('recycle', amount => {
// 	console.log('recycle')
// })

// pool.event.on('amount', amount => {
// 	console.log(amount)
// })
