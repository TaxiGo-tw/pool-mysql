require('dotenv').config({ path: '.env' })


const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`
const assert = require('assert')

const Trips = require('./model/Trips')
const Users = require('./model/Users')
const Block = require('./model/BlockPersonally')

const pool = require('../index')
const Redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(Redis.RedisClient.prototype)
bluebird.promisifyAll(Redis.Multi.prototype)
pool.redisClient = Redis.createClient({
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT,
	db: process.env.NODE_ENV == 'production' ? 14 : 15
})

describe('test query', async () => {
	it('with cache', async () => {
		const id = 23890
		let ii
		const query = Trips.
			SELECT()
			.FROM()
			.WHERE({ trip_id: id })
			.AND({ trip_id: id })
			.AND('trip_id = ?', ii)
			.ORDER_BY('trip_id')
			.LIMIT()
			.EX(2)

		let results = await query.exec()
		results = await query.exec()


		results.length.should.equal(0)
	})

	it('with cache', async () => {
		const query = Trips.
			SELECT()
			.FROM()
			.WHERE({ trip_id: 23890 })
			.AND({ trip_id: 23890 })
			.LIMIT()
			.EX(2)

		const results = await query.exec()

		results[0].should.have.property('trip_id')
		results[0].should.not.have.property('user')
	})

	it('without cache', async () => {
		const id = 23890
		const query = Trips.
			SELECT()
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

		const query = trip.
			SELECT()
			.FROM()
			.WHERE({ trip_id: 23890 })
			.AND({ trip_id: 23890 })
			.FIRST()
			.FILTER(t => t.trip_id != 23890)

		const result = await query.exec()

		should(result).equal(undefined)
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

	it('POPULATE 2', async () => {
		const query = await Trips
			.SELECT()
			.FROM()
			.WHERE({ user_id: 3925 })
			.AND('driver_id')
			.ORDER_BY('trip_id', 'desc')
			.POPULATE('driver_loc', 'driver_info')
			.FIRST()

		const result = await query.exec()
		result.should.have.property('trip_id')
		result.should.have.property('user_id')
		result.driver_loc.should.have.property('location')
		result.driver_info.should.have.property('first_name')
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
		assert(results[0] instanceof Trips)
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
		assert(results[0] instanceof Trips)
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
		results[0].should.have.property('count')
		assert(results[0] instanceof Trips)
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



describe('test PRE & AFTER', async () => {
	it('1', async () => {
		const query = Block
			.UPDATE()
			.SET('id = 2905, blocker = (SELECT @aa := blocker)')
			.WHERE({ id: 2905 })
			.PRE('SET @aa := 0')
			.AFTER('SELECT @aa id ')
			.AFFECTED_ROWS(0)
			.CHANGED_ROWS(0)

		const results = await query.exec()
		results.length.should.equals(3)
		results[2][0].should.have.property('id')
	})

	it('updated', async () => {
		const query = Block
			.UPDATE()
			.SET('id = id')
			.WHERE({ blocked: 22762 })
			.AND({ blocked: 3925 })
			.UPDATED('id', 'blocker')
		// .AFFECTED_ROWS(1)
		// .CHANGED_ROWS(0)
		// .FIRST()
		// .PRINT()
		const results = await query.exec()

		for (const result of results) {
			result.should.have.property('id')
			result.should.have.property('blocker')
		}
	})


	it('updated', async () => {
		const trip_id = 29106

		await Trips
			.UPDATE()
			.SET(`driver_id = 3925, trip_status = 'DRIVER_RESERVED'`)
			.WHERE({ trip_id })
			.FIRST()
			.exec()

		const result = await Trips
			.UPDATE()
			.SET(`driver_id = NULL, trip_status = 'REQUESTING_DRIVER'`)
			.WHERE({ trip_id })
			.AND(`trip_status = 'DRIVER_RESERVED'`)
			.UPDATED('trip_id', 'user_id', 'driver_id')
			.AFFECTED_ROWS(1)
			.FIRST()
			.exec()

		result.should.have.property('trip_id')
		result.should.have.property('user_id')
		result.should.have.property('driver_id')
	})
})

describe('test connection.query()', () => {
	it('3', (done) => {
		pool.createConnection().then(connection => {
			connection.query('SELECT * FROM trips LIMIT 5', (e, r) => {
				connection.release()
				done()
			})
		})
	})
})

describe('test get connection', () => {
	it('1', (done) => {
		pool.getConnection((err, connection) => {
			connection.release()
			done()
		})
	})

	it('2', async () => {
		for (let i = 0; i < 10000; i++) {
			pool.createConnection().then(c => c.release())
		}
	})
})

describe('test pool.query()', () => {
	it('1', (done) => {
		pool.query('SELECT * FROM trips LIMIT 5', (e, r) => {
			done()
		})
	})
})

describe('test release before query warning', () => {
	it('1', (done) => {
		pool.createConnection().then(connection => {
			assert.equal(connection.isUsing, true)
			connection.release()
			assert.equal(connection.isUsing, false)

			connection.query('SELECT * FROM trips LIMIT 5', () => {
				done()
			})
		})
	})
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
