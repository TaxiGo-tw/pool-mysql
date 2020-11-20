const DriverReviewStatus = require('./model/DriverReviewStatus')

const { should } = require('chai')  // Using Assert style
should()  // Modifies `Object.prototype`
const assert = require('assert')

const { Number, String, Email, JSONString, SQLSelectOnlyString, NumberString, Point, Polygon, ENUM, FK, UNIX_TIMESTAMP, DateTime } = require('../model/Schema').Types

describe('test model Validations', async () => {
	it('get pk ', async () => {
		DriverReviewStatus._pk.should.equal('uid')
	})
})


describe('test Validations', async () => {
	it('string', async () => {
		assert.equal(String.validate('hi'), true)
		assert.equal(String.validate(1), false)
		assert.equal(String.validate(true), false)
		assert.equal(String.validate(new Date()), false)
	})

	it('number', async () => {
		assert.equal(Number.validate('hi'), false)
		assert.equal(Number.validate(1), true)
		assert.equal(Number.validate(true), true)
		assert.equal(Number.validate(new Date()), false)
	})

	it('JSON String', async () => {
		assert.equal(JSONString.validate('{}'), true)
		assert.equal(JSONString.validate('{"hi":1}'), true)
		assert.equal(JSONString.validate('{"hi":1}'), true)
		assert.equal(JSONString.validate('{hi:1}'), false)
		assert.equal(JSONString.validate(''), false)
		assert.equal(JSONString.validate('123'), false)
		assert.equal(JSONString.validate(123), false)
		assert.equal(JSONString.validate([]), true)
		assert.equal(JSONString.validate([{ a: 1 }]), true)
		assert.equal(JSONString.validate(), true)
		assert.equal(JSONString.validate(null), true)

		assert.equal(JSONString.inputMapper({}), '{}')
		assert.equal(JSONString.inputMapper({ a: 1 }), '{"a":1}')
		assert.equal(JSONString.inputMapper([]), '[]')
		assert.equal(JSONString.inputMapper([{ a: 1 }]), '[{"a":1}]')
	})

	it('SQL Select Only String', async () => {
		assert.equal(SQLSelectOnlyString.validate('SELECT * FROM t WHERE 1 = 1 LIMIT 100'), true)
		assert.equal(SQLSelectOnlyString.validate('select * from t where 1 = 1 limit 100'), true)
		assert.equal(SQLSelectOnlyString.validate('DROP DATABASE d'), false)
		assert.equal(SQLSelectOnlyString.validate('DROP TABLE t'), false)
		assert.equal(SQLSelectOnlyString.validate('ALTER TABLE t ADD c varchar(255)'), false)
		assert.equal(SQLSelectOnlyString.validate('DELETE FROM t'), false)
		assert.equal(SQLSelectOnlyString.validate(`INSERT INTO t (c1, c2, c3) VALUES('v1', 'v2', 'v3)`), false)
		assert.equal(SQLSelectOnlyString.validate(`UPDATE t SET c1 = 'v1', c2 = 'v2`), false)
		assert.equal(SQLSelectOnlyString.validate(`SELECT * FROM t1; SELECT * FROM t2`), false)

		assert.equal(
			SQLSelectOnlyString.validate(
				`SELECT A.user_id, A.bot_id, count(*) count FROM trips A LEFT JOIN linebot_user B ON A.user_id = B.uid
				WHERE A.trip_status = 'TRIP_PAYMENT_PROCESSED'
				AND B.uid % 2 = 0
				AND bot_type = 'line'
				AND user_status = 'PHONE_VERIFIED'
				AND UNIX_TIMESTAMP(DATE_ADD(created_time, INTERVAL 90 day)) < UNIX_TIMESTAMP()
				AND A.user_id NOT IN (SELECT DISTINCT uid FROM pass_record)
				group by A.user_id HAVING count < 3`),
			true)
	})

	it('Email String', async () => {
		assert.equal(Email.validate('12312gggg@gmail.com'), true)
		assert.equal(Email.validate('@gmail'), false)
		assert.equal(Email.validate('12312gggg@gmail'), false)
		assert.equal(Email.validate('{"hi":1}'), false)
		assert.equal(Email.validate('{___}'), false)
		assert.equal(Email.validate('{hi:1}'), false)
		assert.equal(Email.validate(''), false)
	})

	it('Number String', async () => {
		assert.equal(NumberString.validate('123'), true)
		assert.equal(NumberString.validate('33312'), true)
		assert.equal(NumberString.validate('12312gggg@gmail'), false)
		assert.equal(NumberString.validate('{"hi":1}'), false)
		assert.equal(NumberString.validate('{___}'), false)
		assert.equal(NumberString.validate('{hi:1}'), false)
	})

	it('POINT String', async () => {
		assert.equal(Point.validate('25.5, 123.5'), true)
		assert.equal(Point.validate('25.5,123.5'), true)
		assert.equal(Point.validate('25,123'), true)
		assert.equal(Point.validate('25,123.5'), true)

		assert.equal(Point.validate('25, 123'), true)
		assert.equal(Point.validate('POINT(25.5, 123)'), true)
		assert.equal(Point.validate('POINT(25.5, 123.5)'), true)


		assert.equal(Point.validate({ x: 25, y: 123 }), true)
		assert.equal(Point.validate({ x: 255, y: 123 }), false)
		assert.equal(Point.validate({ x: 55, y: 223 }), false)
		assert.equal(Point.validate({ x: -255, y: 123 }), false)

		assert.equal(Point.validate('5, 300'), false)


		assert.equal(Point.inputMapper('25.5, 123.5').toSqlString(), 'POINT(25.5, 123.5)')
		assert.equal(Point.inputMapper('25.5,123.5').toSqlString(), 'POINT(25.5, 123.5)')
		assert.equal(Point.inputMapper('25,123').toSqlString(), 'POINT(25, 123)')
		assert.equal(Point.inputMapper('25,123.5').toSqlString(), 'POINT(25, 123.5)')

		assert.equal(Point.inputMapper('25, 123').toSqlString(), 'POINT(25, 123)')
		assert.equal(Point.inputMapper('POINT(25.5, 123)').toSqlString(), 'POINT(25.5, 123)')
		assert.equal(Point.inputMapper('POINT(25.5, 123.5)').toSqlString(), 'POINT(25.5, 123.5)')
		assert.equal(Point.inputMapper({ x: 25, y: 123 }).toSqlString(), 'POINT(25, 123)')
		assert.equal(Point.inputMapper({ x: 25, y: 123.5 }).toSqlString(), 'POINT(25, 123.5)')
	})

	it('POLYGON String', async () => {
		assert.equal(Polygon.validate([[{ x: 25, y: 123 }, { x: 25, y: 123 }], [{ x: 20, y: 21 }, { x: 20, y: 21 }]]), true)
		assert.equal(Polygon.validate([[{ x: 25, y: 123 }, { x: 26, y: 124 }], [{ x: 20, y: 21 }, { x: 21, y: 22 }]]), false)
		assert.equal(Polygon.validate('POLYGON((120.6142697642792 24.11499926195014,120.6127945925903 24.11337369999999,120.6125585158691 24.10833031791588,120.6166891539673 24.10824218209207,120.6192361 24.1116606,120.6192801441803 24.11480335381689,120.6142697642792 24.11499926195014))'), true)
		assert.equal(Polygon.validate('((120.6142697642792 24.11499926195014,120.6127945925903 24.11337369999999,120.6125585158691 24.10833031791588,120.6166891539673 24.10824218209207,120.6192361 24.1116606,120.6192801441803 24.11480335381689,120.6142697642792 24.11499926195014))'), true)
		assert.equal(Polygon.inputMapper('((120.6142697642792 24.11499926195014,120.6127945925903 24.11337369999999,120.6125585158691 24.10833031791588,120.6166891539673 24.10824218209207,120.6192361 24.1116606,120.6192801441803 24.11480335381689,120.6142697642792 24.11499926195014))').toSqlString(), 'POLYGON((120.6142697642792 24.11499926195014,120.6127945925903 24.11337369999999,120.6125585158691 24.10833031791588,120.6166891539673 24.10824218209207,120.6192361 24.1116606,120.6192801441803 24.11480335381689,120.6142697642792 24.11499926195014))')
		assert.equal(Polygon.inputMapper('POLYGON((120.6142697642792 24.11499926195014,120.6127945925903 24.11337369999999,120.6125585158691 24.10833031791588,120.6166891539673 24.10824218209207,120.6192361 24.1116606,120.6192801441803 24.11480335381689,120.6142697642792 24.11499926195014))').toSqlString(), 'POLYGON((120.6142697642792 24.11499926195014,120.6127945925903 24.11337369999999,120.6125585158691 24.10833031791588,120.6166891539673 24.10824218209207,120.6192361 24.1116606,120.6192801441803 24.11480335381689,120.6142697642792 24.11499926195014))')
		assert.equal(Polygon.inputMapper([[{ x: 25, y: 123 }, { x: 26, y: 124 }], [{ x: 20, y: 21 }, { x: 21, y: 22 }]]).toSqlString(), 'POLYGON((25 123,26 124),(20 21,21 22))')
	})

	it('FK', async () => {
		const ClassA = FK(require('./model/Trips'), 'trip_id')
		assert.equal(ClassA.validate(1), true)
		assert.equal(ClassA.validate('1'), true)

		const ClassB = FK(require('./model/Trips'), 'start_latlng')
		assert.equal(ClassB.validate('25, 123'), true)
		assert.equal(ClassB.validate('POINT(25.5, 123)'), true)
		assert.equal(ClassB.validate('POINT(25.5, 123.5)'), true)
		assert.equal(ClassB.validate({ x: 25, y: 123 }), true)
		assert.equal(ClassB.validate({ x: 255, y: 123 }), false)

		assert.equal(ClassB.inputMapper('25, 123').toSqlString(), 'POINT(25, 123)')
		assert.equal(ClassB.inputMapper('POINT(25.5, 123)').toSqlString(), 'POINT(25.5, 123)')
		assert.equal(ClassB.inputMapper('POINT(25.5, 123.5)').toSqlString(), 'POINT(25.5, 123.5)')
		assert.equal(ClassB.inputMapper({ x: 25, y: 123 }).toSqlString(), 'POINT(25, 123)')
		assert.equal(ClassB.inputMapper({ x: 25, y: 123.5 }).toSqlString(), 'POINT(25, 123.5)')
	})

	it('ENUM', async () => {
		const ClassA = ENUM('A', 'B', 'C')
		assert.equal(ClassA.validate('A'), true)
		assert.equal(ClassA.validate('D'), false)

		const ClassB = ENUM('D', 'E', 'F')
		assert.equal(ClassB.validate('A'), false)
		assert.equal(ClassB.validate('D'), true)
		assert.equal(ClassB.validate('E'), true)
		assert.equal(ClassB.validate('F'), true)
	})

	it('Timstamp', async () => {
		assert.equal(UNIX_TIMESTAMP.validate('2020-01-01'), true)
		assert.equal(UNIX_TIMESTAMP.validate('2020-01-01 05:00'), true)
		assert.equal(UNIX_TIMESTAMP.validate(1592972101), true)
		assert.equal(UNIX_TIMESTAMP.validate('hihi'), false)

		assert.equal(UNIX_TIMESTAMP.inputMapper('2020-01-01'), 1577836800)
		assert.equal(UNIX_TIMESTAMP.inputMapper('2020-01-01 GMT+08:00'), 1577808000)
		assert.equal(UNIX_TIMESTAMP.inputMapper('2020-01-01 05:00'), 1577854800)
		assert.equal(UNIX_TIMESTAMP.inputMapper(1592972101), 1592972101)
		assert.equal(UNIX_TIMESTAMP.inputMapper('2020-01-01 08:32:50 GMT+08:00'), 1577838770)
	})

	it('Date Time', async () => {
		assert.equal(DateTime.validate('2020-01-01'), true)
		assert.equal(DateTime.validate('2020-01-01 05:00'), true)
		assert.equal(DateTime.validate(1592972101), true)
		assert.equal(DateTime.validate('hihi'), false)

		assert.equal(DateTime.inputMapper('2020-01-01'), '2020-01-01 00:00:00')
		assert.equal(DateTime.inputMapper('2020-01-01 GMT+08:00'), '2019-12-31 16:00:00')
		assert.equal(DateTime.inputMapper('2020-01-01 05:00'), '2020-01-01 05:00:00')
		assert.equal(DateTime.inputMapper(1592972101), '2020-06-24 04:15:01')
		assert.equal(DateTime.inputMapper('1970-01-01 08:32:50 GMT+08:00'), '1970-01-01 00:32:50')
	})
})

describe('test JSON model Validations', async () => {
	it('JSON model pass', async () => {
		const obj = new DriverReviewStatus({
			uid: 123,
			first_name: 'lova5',
			last_name: 'hi',
			email: '123@gg.mail',
			car_brand: '{"brand":"bmw"}',
			phone_number: '0911957274',
			plate_number: '123-AAA',
			enum: '123123'
		})

		assert(obj.validate(true))
	})

	it('JSON model pass 2', async () => {
		const obj = new DriverReviewStatus({
			uid: 123,
			first_name: 'lova5',
			last_name: 'hi',
			email: '123@gg.mail',
			car_brand: '{"brand":"bmw"}'
		})

		assert(obj.validate())
	})

	it('JSON model pass 2', async () => {
		const obj = new DriverReviewStatus({
			uid: 123,
		})

		assert(obj.validate())

		const obj2 = new DriverReviewStatus({ last_name: 123 })
		assert.throws(() => { obj2.validate() }, { message: `driver_review_status.last_name must be type: 'Str', not 'number' {"last_name":123}` })
		assert.throws(() => { obj2.validate(true) }, { message: `uid is required` })
	})


	it('JSON model', async () => {
		const obj = new DriverReviewStatus({ uid: 123, first_name: 'lova', email: '123@gg.mail', car_brand: '' })

		assert.throws(() => { obj.validate(true) }, {
			message: 'driver_review_status.first_name.length should be 5, now is 4'
		})
	})
})
